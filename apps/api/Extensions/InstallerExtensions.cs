using RepairLedger.Api.Installers;
namespace RepairLedger.Api.Extensions;

public static class InstallerExtensions
{
    public static void InstallServicesInAssembly(this IServiceCollection services, IConfiguration configuration)
        => new DependenciesInstaller().InstallServices(services, configuration);
}
