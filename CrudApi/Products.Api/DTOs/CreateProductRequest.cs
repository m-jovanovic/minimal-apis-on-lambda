namespace Products.Api.DTOs;

public record CreateProductRequest(string Name, string Description, decimal Price);
