import { useEffect, useRef } from "react";

const TAB_STOP_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

type OverlayEntry = {
  root: HTMLElement;
  previousFocus: HTMLElement | null;
};

type OverlayState = {
  stack: OverlayEntry[];
  scrollLocks: number;
  body: HTMLElement;
  originalOverflow: string;
  originalOverflowPriority: string;
};

// A document may contain several portals, including an overlay over another overlay.
const overlayStates = new WeakMap<Document, OverlayState>();

function getTabStops(root: HTMLElement): HTMLElement[] {
  const view = root.ownerDocument.defaultView;
  const controls = Array.from(
    root.querySelectorAll<HTMLElement>(TAB_STOP_SELECTOR),
  ).filter((element) => {
    if (
      typeof element.focus !== "function" ||
      element.tabIndex < 0 ||
      element.matches(":disabled, [aria-disabled='true']") ||
      element.closest("[hidden], [inert], [aria-hidden='true']") ||
      element.getClientRects().length === 0
    ) {
      return false;
    }
    const visibility = view?.getComputedStyle(element).visibility;
    return visibility !== "hidden" && visibility !== "collapse";
  });

  // Native Tab navigation enters a radio group at its checked item (or first item).
  const tabStops = controls.filter((element) => {
    if (element.tagName !== "INPUT") return true;
    const radio = element as HTMLInputElement;
    if (radio.type !== "radio" || !radio.name) return true;
    const group = controls.filter((candidate) => {
      if (candidate.tagName !== "INPUT") return false;
      const input = candidate as HTMLInputElement;
      return (
        input.type === "radio" &&
        input.name === radio.name &&
        input.form === radio.form
      );
    }) as HTMLInputElement[];
    return radio === (group.find((input) => input.checked) ?? group[0]);
  });

  // Match the browser's tab order, including any existing positive tabindex values.
  return tabStops.sort((left, right) => {
    const leftOrder = left.tabIndex > 0 ? left.tabIndex : Infinity;
    const rightOrder = right.tabIndex > 0 ? right.tabIndex : Infinity;
    return leftOrder === rightOrder ? 0 : leftOrder - rightOrder;
  });
}

function focusInside(root: HTMLElement, last = false): void {
  const controls = getTabStops(root);
  (last ? controls[controls.length - 1] ?? root : controls[0] ?? root).focus({
    preventScroll: true,
  });
}

/**
 * Attach the returned ref to the dialog/drawer content, not its backdrop.
 * The content must be mounted when active becomes true. Keep role="dialog",
 * aria-modal, accessible naming, and a visible close button in the component.
 * Focus and scroll ownership are shared by all instances of this hook.
 */
export function useOverlayFocus<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onClose: () => void,
) {
  const overlayRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = overlayRef.current;
    if (!active || !root) return;

    const document = root.ownerDocument;
    const focused = document.activeElement;
    const entry: OverlayEntry = {
      root,
      previousFocus:
        focused && typeof (focused as HTMLElement).focus === "function"
          ? (focused as HTMLElement)
          : null,
    };
    let state = overlayStates.get(document);
    if (!state) {
      state = {
        stack: [],
        scrollLocks: 0,
        body: document.body,
        originalOverflow: document.body.style.getPropertyValue("overflow"),
        originalOverflowPriority:
          document.body.style.getPropertyPriority("overflow"),
      };
      overlayStates.set(document, state);
    }
    const overlayState = state;
    overlayState.stack.push(entry);
    overlayState.scrollLocks += 1;
    overlayState.body.style.setProperty("overflow", "hidden", "important");

    const addedTabIndex = !root.hasAttribute("tabindex");
    if (addedTabIndex) root.setAttribute("tabindex", "-1");
    const isTopOverlay = () =>
      overlayState.stack[overlayState.stack.length - 1] === entry;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay() || event.defaultPrevented || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (
        event.key !== "Tab" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      // Re-read controls because validation and asynchronous content can change them.
      const controls = getTabStops(root);
      const focusedIndex = controls.indexOf(document.activeElement as HTMLElement);
      if (controls.length === 0) {
        event.preventDefault();
        root.focus({ preventScroll: true });
      } else if (focusedIndex < 0) {
        event.preventDefault();
        focusInside(root, event.shiftKey);
      } else if (event.shiftKey && focusedIndex === 0) {
        event.preventDefault();
        controls[controls.length - 1].focus({ preventScroll: true });
      } else if (!event.shiftKey && focusedIndex === controls.length - 1) {
        event.preventDefault();
        controls[0].focus({ preventScroll: true });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (isTopOverlay() && !root.contains(event.target as Node | null)) {
        focusInside(root);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    focusInside(root);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const index = overlayState.stack.indexOf(entry);
      const wasTop = isTopOverlay();
      if (index !== -1) {
        // If a lower dialog closes first, its child should restore the original
        // trigger later instead of trying to restore focus into the removed dialog.
        for (const overlay of overlayState.stack.slice(index + 1)) {
          if (overlay.previousFocus && root.contains(overlay.previousFocus)) {
            overlay.previousFocus = entry.previousFocus;
          }
        }
        overlayState.stack.splice(index, 1);
      }
      overlayState.scrollLocks -= 1;
      if (overlayState.scrollLocks === 0) {
        if (overlayState.originalOverflow) {
          overlayState.body.style.setProperty(
            "overflow",
            overlayState.originalOverflow,
            overlayState.originalOverflowPriority,
          );
        } else {
          overlayState.body.style.removeProperty("overflow");
        }
        overlayStates.delete(document);
      }
      if (addedTabIndex && root.getAttribute("tabindex") === "-1") {
        root.removeAttribute("tabindex");
      }
      if (!wasTop) return;

      const nextOverlay = overlayState.stack[overlayState.stack.length - 1];
      const previous = entry.previousFocus;
      if (
        previous?.isConnected &&
        (!nextOverlay || nextOverlay.root.contains(previous))
      ) {
        previous.focus({ preventScroll: true });
      }
      if (
        nextOverlay?.root.isConnected &&
        !nextOverlay.root.contains(document.activeElement)
      ) {
        focusInside(nextOverlay.root);
      }
    };
  }, [active]);

  return overlayRef;
}
