namespace Products.Api.Models;

public record Product(int Id, string Name, string Description, decimal Price, DateTime CreatedAt);
