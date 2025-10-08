-- Create Products table
CREATE TABLE IF NOT EXISTS Products (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    Description TEXT,
    Price DECIMAL(10,2) NOT NULL,
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on CreatedAt for better performance on ordering
CREATE INDEX IF NOT EXISTS IX_Products_CreatedAt ON Products(CreatedAt);
