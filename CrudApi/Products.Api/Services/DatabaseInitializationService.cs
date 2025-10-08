using Dapper;
using Npgsql;

namespace Products.Api.Services;

public class DatabaseInitializationService : BackgroundService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<DatabaseInitializationService> _logger;

    public DatabaseInitializationService(IConfiguration configuration, ILogger<DatabaseInitializationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("Starting database initialization...");
            
            // Get the connection string for the default postgres database
            var connectionString = _configuration.GetConnectionString("Database");
            if (string.IsNullOrEmpty(connectionString))
            {
                _logger.LogError("Database connection string not found");
                return;
            }

            // Parse the connection string to get database name
            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            var databaseName = builder.Database;
            var serverConnectionString = connectionString.Replace($"Database={databaseName}", "Database=postgres");

            // Create database if it doesn't exist
            await CreateDatabaseIfNotExistsAsync(serverConnectionString, databaseName);
            
            // Create table if it doesn't exist
            await CreateTableIfNotExistsAsync(connectionString);
            
            _logger.LogInformation("Database initialization completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during database initialization");
        }
    }

    private async Task CreateDatabaseIfNotExistsAsync(string serverConnectionString, string databaseName)
    {
        try
        {
            await using var connection = new NpgsqlConnection(serverConnectionString);
            await connection.OpenAsync();
            
            var checkDbSql = "SELECT 1 FROM pg_database WHERE datname = @DatabaseName";
            var dbExists = await connection.QueryFirstOrDefaultAsync<int?>(checkDbSql, new { DatabaseName = databaseName });
            
            if (dbExists == null)
            {
                _logger.LogInformation("Creating database: {DatabaseName}", databaseName);
                var createDbSql = $"CREATE DATABASE \"{databaseName}\"";
                await connection.ExecuteAsync(createDbSql);
                _logger.LogInformation("Database {DatabaseName} created successfully", databaseName);
            }
            else
            {
                _logger.LogInformation("Database {DatabaseName} already exists", databaseName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating database {DatabaseName}", databaseName);
            throw;
        }
    }

    private async Task CreateTableIfNotExistsAsync(string connectionString)
    {
        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            
            var createTableSql = """
                CREATE TABLE IF NOT EXISTS Products (
                    Id SERIAL PRIMARY KEY,
                    Name VARCHAR(255) NOT NULL,
                    Description TEXT,
                    Price DECIMAL(10,2) NOT NULL,
                    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                """;
            
            await connection.ExecuteAsync(createTableSql);
            
            // Create index if it doesn't exist
            var createIndexSql = "CREATE INDEX IF NOT EXISTS IX_Products_CreatedAt ON Products(CreatedAt)";
            await connection.ExecuteAsync(createIndexSql);
            
            _logger.LogInformation("Products table and index created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Products table");
            throw;
        }
    }
}
