namespace Products.Api.DTOs;

public record ProductResponse(int Id, string Name, string Description, decimal Price, DateTime CreatedAt);
