using RepairLedger.Api.Helpers;
using Xunit;
namespace RepairLedger.Api.Tests;

public sealed class SqlScriptTests
{
    [Fact]
    public void Migration_checksums_are_stable_across_Windows_and_Linux_line_endings() =>
        Assert.Equal(SqlScriptHelper.Checksum("SELECT 1;\r\nSELECT 2;\r\n"), SqlScriptHelper.Checksum("SELECT 1;\nSELECT 2;\n"));

    [Fact]
    public void Semicolons_inside_quotes_and_comments_are_not_statement_boundaries()
    {
        var statements = SqlScriptHelper.SplitStatements("-- comment ;\nSELECT 'a;b', 'it''s;fine'; /* ; */ SELECT \"x;y\"; # ;\nSELECT 3;").ToList();
        Assert.Equal(3, statements.Count);
        Assert.Contains("'a;b'", statements[0]);
        Assert.Contains("\"x;y\"", statements[1]);
    }

    [Theory]
    [InlineData("SELECT 'unterminated")]
    [InlineData("SELECT 1; /* unterminated")]
    public void Malformed_owned_SQL_fails_explicitly(string sql) =>
        Assert.Throws<InvalidOperationException>(() => SqlScriptHelper.SplitStatements(sql).ToList());

    [Fact]
    public void Escaped_quotes_and_quoted_identifiers_are_preserved()
    {
        var sql = "SELECT 'it\\'s;fine', " + (char)96 + "semi;colon" + (char)96 + "; SELECT 2";
        Assert.Equal(2, SqlScriptHelper.SplitStatements(sql).Count());
    }
}
