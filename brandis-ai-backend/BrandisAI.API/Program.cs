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

// Configure OpenAI options
builder.Services.Configure<OpenAIOptions>(
    builder.Configuration.GetSection(OpenAIOptions.SectionName));

// Register application and infrastructure services
builder.Services.AddSingleton<IDiscussionRepository, InMemoryDiscussionRepository>();

// Register OpenAI service with HttpClient
builder.Services.AddHttpClient<IAIService, OpenAIService>();

// Register application service
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

app.UseRouting();

app.UseCors();

app.UseAuthorization();

app.MapControllers();

app.Run();
