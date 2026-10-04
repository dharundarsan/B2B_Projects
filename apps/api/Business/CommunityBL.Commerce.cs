namespace RepairLedger.Api.Business;

public sealed partial class CommunityBL
{
    public Task<CommunitySeller> Seller(Actor actor, string property, SellerInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Provider(actor); var user = actor.IsManager && !string.IsNullOrWhiteSpace(input.UserId) ? input.UserId.Trim() : actor.Id;
        Require(actor.IsManager || input.UserId == null || input.UserId == actor.Id, "You can only register your own store.", 403);
        Require(user == actor.Id || Guid.TryParse(user, out _), "Use a seller account UUID.");
        Require(user==actor.Id||await s.SellerAccount(user),"Choose an active account with Seller / Provider access in this workspace.",403);
        Require(!d.Sellers.Any(seller => seller.UserId == user && seller.Status != "rejected"), "This account already has a store in this building.", 409);
        return await s.Insert("Seller", new CommunitySeller { UserId = user, Name = Text(input.Name, 200, "Store name"), Kind = Choice(input.Kind, "shop", "resident"), Pickup = Text(input.Pickup, 300, "Pickup location"), Status = actor.IsManager ? "approved" : "pending" }, Now);
    }, ct);
    public Task<CommunitySeller> SellerAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        actor.RequireManager(); var row = Find(d.Sellers, id); var action = Choice(input.Action, "approve", "reject", "suspend");
        Require(action != "reject" || row.Status == "pending", "Only a pending application can be rejected.", 409);
        row.Status = action == "approve" ? "approved" : action == "reject" ? "rejected" : "suspended"; return s.Update("Seller", row, input.Revision, "Seller." + action, Now);
    }, ct);
    public Task<CommunityProduct> Product(Actor actor, string property, ProductInput input, string? id, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        var seller = Find(d.Sellers, input.SellerId); SellerAccess(actor, seller); Require(seller.Status == "approved", "The store must be approved first.", 409);
        Require(input.Stock is >= 0 and <= 1000000, "Stock must be between 0 and 1,000,000.");
        var row = id == null ? new CommunityProduct() : Find(d.Products, id); Require(id == null || row.SellerId == seller.Id, "A product cannot move between sellers.");
        row.SellerId = seller.Id; row.Name = Text(input.Name, 200, "Product name"); row.Description = Text(input.Description, 2000, "Description", true); row.Kind = Choice(input.Kind, "product", "grocery", "food");
        row.Ingredients = Text(input.Ingredients, 2000, "Ingredients", row.Kind != "food"); row.Allergens = Text(input.Allergens, 2000, "Allergens", row.Kind != "food"); row.Price = Money(input.Price); row.Currency = Currency(input.Currency); row.Stock = input.Stock; row.Status = Choice(input.Status, "active", "paused");
        return id == null ? s.Insert("Product", row, Now) : s.Update("Product", row, input.Revision, "Product.updated", Now);
    }, ct);
    public Task<CommunityOrder> Order(Actor actor, string property, OrderInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Buyer(actor); var product = Find(d.Products, input.ProductId); var seller = Find(d.Sellers, product.SellerId); var submission = Submission(input.SubmissionId);
        var previous = d.Orders.SingleOrDefault(o => o.UserId == actor.Id && o.SubmissionId == submission);
        if (previous != null) { Require(previous.ProductId == product.Id && previous.Quantity == input.Quantity && previous.GroupId == null, "Submission ID was used for another order.", 409); return previous; }
        Require(seller.Status == "approved" && product.Status == "active", "This item is unavailable.", 409);
        Require(input.Quantity is > 0 and <= 10000, "Choose 1–10,000 items."); Require(product.Stock >= input.Quantity, "Insufficient stock.", 409); Money(product.Price * input.Quantity);
        product.Stock -= input.Quantity; await s.Update("Product", product, product.Revision, "Product.stock_reserved", Now);
        return await s.Insert("Order", new CommunityOrder { ProductId = product.Id, SellerId = seller.Id, UserId = actor.Id, Quantity = input.Quantity, UnitPrice = product.Price, Currency = product.Currency, SubmissionId = submission }, Now);
    }, ct);
    public Task<CommunityOrder> OrderAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Member(actor); var row = Find(d.Orders, id); var seller = Find(d.Sellers, row.SellerId); var manages = actor.IsManager || actor.Context==3 && actor.CanSell && seller.UserId == actor.Id;
        Require(manages || row.UserId == actor.Id, "This order belongs to another account.", 403); var action = Choice(input.Action, "accept", "ready", "handover", "cancel", "paid", "refunded");
        if (action == "cancel")
        {
            if(!manages) Buyer(actor);
            if(manages && row.UserId!=actor.Id) SellerAccess(actor,seller);
            Require(manages ? row.Status is "placed" or "accepted" or "ready" : row.Status == "placed", "This order can no longer be cancelled by you.", 409);
            var product = Find(d.Products, row.ProductId); product.Stock += row.Quantity; await s.Update("Product", product, product.Revision, "Product.stock_released", Now); row.Status = "cancelled";
            if (row.PaymentStatus == "paid") row.PaymentStatus = "refund_due";
        }
        else
        {
            Require(manages, "Seller access required.", 403);
            SellerAccess(actor,seller);
            if (action == "paid") { Require(row.Status != "cancelled" && row.PaymentStatus == "unpaid", "Only an unpaid active order can be marked paid.", 409); row.PaymentStatus = "paid"; }
            else if (action == "refunded") { Require(row.Status == "cancelled" && row.PaymentStatus == "refund_due", "No refund is due.", 409); row.PaymentStatus = "refunded"; }
            else { var expected = action == "accept" ? "placed" : action == "ready" ? "accepted" : "ready"; Require(row.Status == expected, "Complete the preceding order step first.", 409); row.Status = action == "accept" ? "accepted" : action == "ready" ? "ready" : "handed_over"; }
        }
        return await s.Update("Order", row, input.Revision, "Order." + action, Now);
    }, ct);
    public Task<GroupBuy> Group(Actor actor, string property, GroupInput input, CancellationToken ct) => Write(actor, property, (s, d) =>
    {
        var product = Find(d.Products, input.ProductId); var seller = Find(d.Sellers, product.SellerId); SellerAccess(actor, seller);
        Require(seller.Status == "approved" && product.Status == "active", "Choose an active approved product.", 409);
        var close = Instant(input.ClosesAt); var date = DateTimeOffset.Parse(close);
        Require(date > clock.GetUtcNow() && date <= clock.GetUtcNow().AddDays(90), "Set the deadline within the next 90 days.");
        Require(input.Minimum > 0 && input.Maximum >= input.Minimum && input.Maximum <= 1000000, "Check the minimum and maximum quantities."); Money(input.UnitPrice * input.Maximum);
        return s.Insert("Group", new GroupBuy { ProductId = product.Id, SellerId = seller.Id, UnitPrice = Money(input.UnitPrice), Currency = product.Currency, Minimum = input.Minimum, Maximum = input.Maximum, ClosesAt = close, Pickup = Text(input.Pickup, 300, "Group pickup plan") }, Now);
    }, ct);
    public Task<GroupBuy> Pledge(Actor actor, string property, string id, PledgeInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        Buyer(actor); var row = Find(d.Groups, id); var seller = Find(d.Sellers, row.SellerId); var product = Find(d.Products, row.ProductId);
        Require(row.Status == "open" && DateTimeOffset.Parse(row.ClosesAt) > clock.GetUtcNow() && seller.Status == "approved" && product.Status == "active", "This group is closed for commitments.", 409);
        Require(input.Quantity is >= 0 and <= 10000, "Choose 0–10,000 items; zero withdraws your commitment.");
        var previous = d.Pledges.SingleOrDefault(p => p.GroupId == id && p.UserId == actor.Id); var total = d.Pledges.Where(p => p.GroupId == id && p.UserId != actor.Id).Sum(p => p.Quantity) + input.Quantity;
        Require(total <= row.Maximum, "This group has reached its maximum quantity.", 409);
        // A group revision protects commitments from another participant changing the total concurrently.
        await s.Update("Group", row, input.Revision, "Group.commitment_changed", Now);
        if (previous == null) await s.Insert("Pledge", new GroupPledge { GroupId = id, UserId = actor.Id, Quantity = input.Quantity }, Now);
        else { previous.Quantity = input.Quantity; await s.Update("Pledge", previous, previous.Revision, "Pledge.updated", Now); }
        row.Committed = total; row.MyQuantity = input.Quantity; return row;
    }, ct);
    public Task<GroupBuy> GroupAction(Actor actor, string property, string id, CommunityActionInput input, CancellationToken ct) => Write(actor, property, async (s, d) =>
    {
        var row = Find(d.Groups, id); SellerAccess(actor, Find(d.Sellers, row.SellerId)); var action = Choice(input.Action, "finalize", "cancel");
        Require(row.Status == "open", "This group has already been resolved.", 409);
        Require(action == "cancel" || DateTimeOffset.Parse(row.ClosesAt) <= clock.GetUtcNow(), "Wait until the commitment deadline before finalizing.", 409);
        Require(row.Revision == input.Revision, "This group changed. Refresh first.", 409);
        var pledges = d.Pledges.Where(p => p.GroupId == id && p.Quantity > 0).ToList(); var total = pledges.Sum(p => p.Quantity); var product = Find(d.Products, row.ProductId); var seller = Find(d.Sellers, row.SellerId);
        if (action == "cancel" || total < row.Minimum || total > row.Maximum || product.Stock < total || product.Status != "active" || seller.Status != "approved") row.Status = "failed";
        else
        {
            product.Stock -= total; await s.Update("Product", product, product.Revision, "Product.group_stock_reserved", Now);
            foreach (var pledge in pledges) await s.Insert("Order", new CommunityOrder { ProductId = product.Id, SellerId = row.SellerId, UserId = pledge.UserId, GroupId = id, Quantity = pledge.Quantity, UnitPrice = row.UnitPrice, Currency = row.Currency, SubmissionId = "group:" + id + ":" + pledge.Id }, Now);
            row.Status = "confirmed";
        }
        row.Committed = total; return await s.Update("Group", row, input.Revision, "Group." + row.Status, Now);
    }, ct);
}
