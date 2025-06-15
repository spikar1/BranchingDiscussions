using BrandisAI.Application.Services;
using BrandisAI.Core.Interfaces;
using BrandisAI.Infrastructure.AI;
using BrandisAI.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register application and infrastructure services
builder.Services.AddSingleton<IDiscussionRepository, InMemoryDiscussionRepository>();
builder.Services.AddSingleton<IAIService, MockAIService>();
builder.Services.AddScoped<DiscussionService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => {
        policy.WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthorization();

app.MapControllers();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
