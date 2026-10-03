using System.Text;
namespace RepairLedger.Api.Helpers;

/// <summary>Splits owned SQL resources; handles quotes/comments, not DELIMITER/stored-procedure blocks.</summary>
public static class SqlScriptHelper
{
    public static string Checksum(string script) => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
        Encoding.UTF8.GetBytes(script.Replace("\r\n", "\n", StringComparison.Ordinal).Trim())));

    public static IEnumerable<string> SplitStatements(string script)
    {
        var buffer = new StringBuilder();
        char quote = '\0'; var lineComment = false; var blockComment = false;
        for (var i = 0; i < script.Length; i++)
        {
            var c = script[i]; var next = i + 1 < script.Length ? script[i + 1] : '\0';
            if (lineComment) { if (c == '\n') { lineComment = false; buffer.Append(' '); } continue; }
            if (blockComment) { if (c == '*' && next == '/') { blockComment = false; i++; buffer.Append(' '); } continue; }
            if (quote != '\0')
            {
                buffer.Append(c);
                if (c == '\\' && next != '\0') { buffer.Append(next); i++; }
                else if (c == quote)
                {
                    if (next == quote) { buffer.Append(next); i++; } else quote = '\0';
                }
                continue;
            }
            if (c == '-' && next == '-' && (i + 2 == script.Length || char.IsWhiteSpace(script[i + 2]))) { lineComment = true; i++; continue; }
            if (c == '#') { lineComment = true; continue; }
            if (c == '/' && next == '*') { blockComment = true; i++; continue; }
            if (c is '\'' or '"' || c == (char)96) { quote = c; buffer.Append(c); continue; }
            if (c == ';')
            {
                var statement = buffer.ToString().Trim(); buffer.Clear();
                if (statement.Length > 0) yield return statement;
            }
            else buffer.Append(c);
        }
        if (quote != '\0' || blockComment) throw new InvalidOperationException("Unterminated quote/comment in embedded SQL.");
        var remaining = buffer.ToString().Trim();
        if (remaining.Length > 0) yield return remaining;
    }
}
