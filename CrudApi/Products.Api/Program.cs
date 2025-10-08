using Dapper;
using Npgsql;
using Products.Api.DTOs;
using Products.Api.Models;
using Products.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure database connection
builder.Services.AddSingleton<NpgsqlDataSource>(_ =>
{
    var connectionString = builder.Configuration.GetConnectionString("Database");
    var dataSource = NpgsqlDataSource.Create(connectionString!);
    return dataSource;
});

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Register background service for database initialization
//builder.Services.AddHostedService<DatabaseInitializationService>();

var app = builder.Build();

app.UseHttpsRedirection();

// GET /products - Get all products
app.MapGet("/products", async (NpgsqlDataSource dataSource) =>
{
    const string sql = "SELECT Id, Name, Description, Price, CreatedAt FROM Products ORDER BY CreatedAt DESC";
    await using var connection = await dataSource.OpenConnectionAsync();
    var products = await connection.QueryAsync<Product>(sql);
    return products.Select(p => new ProductResponse(p.Id, p.Name, p.Description, p.Price, p.CreatedAt));
});

// GET /products/{id} - Get product by ID
app.MapGet("/products/{id:int}", async (int id, NpgsqlDataSource dataSource) =>
{
    const string sql = "SELECT Id, Name, Description, Price, CreatedAt FROM Products WHERE Id = @Id";
    await using var connection = await dataSource.OpenConnectionAsync();
    var product = await connection.QueryFirstOrDefaultAsync<Product>(sql, new { Id = id });

    if (product == null)
    {
        return Results.NotFound();
    }
    
    return Results.Ok(new ProductResponse(product.Id, product.Name, product.Description, product.Price, product.CreatedAt));
});

// POST /products - Create new product
app.MapPost("/products", async (CreateProductRequest request, NpgsqlDataSource dataSource) =>
{
    const string sql =
        """
        INSERT INTO Products (Name, Description, Price, CreatedAt) 
        VALUES (@Name, @Description, @Price, @CreatedAt) 
        RETURNING Id, Name, Description, Price, CreatedAt
        """;
    
    await using var connection = await dataSource.OpenConnectionAsync();
    var product = await connection.QueryFirstAsync<Product>(sql, new 
    { 
        request.Name, 
        request.Description, 
        request.Price, 
        CreatedAt = DateTime.UtcNow 
    });
    
    return Results.Created($"/products/{product.Id}", new ProductResponse(product.Id, product.Name, product.Description, product.Price, product.CreatedAt));
});

// PUT /products/{id} - Update product
app.MapPut("/products/{id:int}", async (int id, UpdateProductRequest request, NpgsqlDataSource dataSource) =>
{
    const string sql =
        """
        UPDATE Products 
        SET Name = @Name, Description = @Description, Price = @Price 
        WHERE Id = @Id 
        RETURNING Id, Name, Description, Price, CreatedAt
        """;
    
    await using var connection = await dataSource.OpenConnectionAsync();
    var product = await connection.QueryFirstOrDefaultAsync<Product>(sql, new 
    { 
        Id = id,
        request.Name, 
        request.Description, 
        request.Price 
    });

    if (product == null)
    {
        return Results.NotFound();
    }
    
    return Results.Ok(new ProductResponse(product.Id, product.Name, product.Description, product.Price, product.CreatedAt));
});

// DELETE /products/{id} - Delete product
app.MapDelete("/products/{id:int}", async (int id, NpgsqlDataSource dataSource) =>
{
    const string sql = "DELETE FROM Products WHERE Id = @Id";
    await using var connection = await dataSource.OpenConnectionAsync();
    var rowsAffected = await connection.ExecuteAsync(sql, new { Id = id });

    if (rowsAffected == 0)
    {
        return Results.NotFound();
    }
    
    return Results.NoContent();
});

app.Run();
