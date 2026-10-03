using RepairLedger.Api.Extensions;
namespace RepairLedger.Api.Installers;

public sealed class DependenciesInstaller : IInstaller
{
    public void InstallServices(IServiceCollection services, IConfiguration configuration) => services.ConfigureDependencyInjections(configuration);
}
