FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NuGet.Config global.json ./
COPY apps/api/RepairLedger.Api.csproj apps/api/
RUN dotnet restore apps/api/RepairLedger.Api.csproj
COPY apps/api/ apps/api/
RUN dotnet publish apps/api/RepairLedger.Api.csproj -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "RepairLedger.Api.dll"]
