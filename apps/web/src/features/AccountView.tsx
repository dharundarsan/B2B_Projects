import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Check, LogOut, UserRound } from "lucide-react";
import { request } from "../api";
import { supabase, demoMode } from "../supabase";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorNotice, LoadingState } from "../components/common";
import { viewName, viewHome, type AccountView } from "../../../../shared/accountView";
import "./accountView.css";
const load = (signal: AbortSignal) => request<{data:AccountView}>("/api/user/context",{signal});
const ViewContext=createContext<{view:AccountView;switchView:(next:1|2|3)=>Promise<void>;refreshAccount:()=>void}|null>(null);
export function AccountViewProvider({children}:{children:ReactNode}){
  const resource=useApiResource<AccountView|null>(load,null);
  if(!resource.data)return resource.error?<ErrorNotice message={resource.error} onRetry={resource.refresh}/>:<LoadingState label="Loading your account…"/>;
  const switchView=async(next:1|2|3)=>{try{
    const response=await request<{data:AccountView}>("/api/user/context",{method:"PATCH",body:JSON.stringify({userContext:next,revision:resource.data!.revision})});
    resource.setData(response.data);
  }catch(e){resource.refresh();throw e;}};
  return <ViewContext.Provider value={{view:resource.data,switchView,refreshAccount:resource.refresh}}><div key={resource.data.userContext}>{children}</div></ViewContext.Provider>;
}
export function useAccountView(){const value=useContext(ViewContext);if(!value)throw new Error("AccountViewProvider is required.");return value;}
export function ProfileMenu(){
  const {view,switchView}=useAccountView();const navigate=useNavigate();const location=useLocation();
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const ref=useRef<HTMLDivElement>(null);const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false)};
    const items=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')??[]);
    (items().find(e=>e.getAttribute('aria-current')==='true')??items()[0])?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}
      if(ref.current?.contains(e.target as Node)&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const list=items();const current=list.indexOf(document.activeElement as HTMLElement);const next=e.key==='Home'?0:e.key==='End'?list.length-1:(current+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;list[next]?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",key)};},[open]);
  const change=async(next:1|2|3)=>{setBusy(true);setError("");try{await switchView(next);const property=new URLSearchParams(location.search).get("property");
    navigate({pathname:viewHome(next,view.role),search:property?"?"+new URLSearchParams({property}):""});setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not change view.");}finally{setBusy(false)}};
  const views=view.availableContexts??(view.role==="owner"||view.role==="manager"||view.role==="demo"?[1,2,3]:[1]);
  return <div className="ch-profile" ref={ref}>
    <button className="ch-profile-trigger" ref={button} aria-label="Open profile menu" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(!open)}>
      <span className="ch-avatar">{(view.displayName||view.email||"C").slice(0,1).toUpperCase()}</span>
      <span className="ch-profile-label"><strong>{view.displayName||"Your account"}</strong><small>{viewName(view.userContext)} view</small></span><ChevronDown size={15}/>
    </button>
    {open&&<div className="ch-profile-menu" role="menu" aria-label="Profile and views">
      <div className="ch-profile-details"><strong>{view.displayName}</strong><small>{view.email}</small></div>
      {views.length>1&&<><span className="ch-menu-caption">SWITCH YOUR VIEW</span>{views.map(next=><button role="menuitem" key={next} disabled={busy} aria-current={view.userContext===next?"true":undefined} onClick={()=>void change(next as 1|2|3)}><UserRound size={16}/><span>{viewName(next)} view</span>{view.userContext===next&&<Check size={16}/>}</button>)}</>}
      <Link role="menuitem" to={{pathname:viewHome(view.userContext,view.role),search:new URLSearchParams(location.search).has('property')?new URLSearchParams({property:new URLSearchParams(location.search).get('property')!}).toString():''}} onClick={()=>setOpen(false)}>Go to your home</Link>
      {!demoMode&&<button role="menuitem" onClick={()=>void supabase?.auth.signOut({scope:"local"}).then(r=>{if(r.error)setError(r.error.message)}).catch(()=>setError("Could not sign out."))}><LogOut size={16}/>Sign out</button>}
      {demoMode&&<small className="ch-menu-caption">Local demonstration account</small>}
      {error&&<p role="alert">{error}</p>}
    </div>}
  </div>;
}
// Existing callers now use the same profile menu rather than separate view buttons.
export const AccountViewSwitch=ProfileMenu;

