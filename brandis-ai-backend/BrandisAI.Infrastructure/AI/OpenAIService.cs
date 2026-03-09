using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using BrandisAI.Core.Interfaces;
using Microsoft.Extensions.Options;

namespace BrandisAI.Infrastructure.AI
{
    public class OpenAIService : IAIService
    {
        private readonly HttpClient _httpClient;
        private readonly OpenAIOptions _options;

        public OpenAIService(HttpClient httpClient, IOptions<OpenAIOptions> options)
        {
            _httpClient = httpClient;
            _options = options.Value;
            _httpClient.BaseAddress = new Uri("https://api.openai.com/v1/");
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_options.ApiKey}");
        }

        public async Task<string> GenerateResponseAsync(string userMessage, string context = null)
        {
            if (string.IsNullOrWhiteSpace(userMessage))
            {
                throw new ArgumentException("User message cannot be null or empty.", nameof(userMessage));
            }

            var messages = new List<object>
            {
                new { role = "system", content = _options.SystemPrompt ?? "You are a helpful assistant." }
            };

            // Add conversation context if provided
            if (!string.IsNullOrWhiteSpace(context))
            {
                messages.Add(new { role = "system", content = $"Previous conversation context: {context}" });
            }

            // Add the user's current message
            messages.Add(new { role = "user", content = userMessage });

            var requestBody = new
            {
                model = _options.Model ?? "gpt-3.5-turbo",
                messages = messages,
                max_tokens = _options.MaxTokens ?? 500,
                temperature = _options.Temperature ?? 0.7
            };

            var jsonRequest = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonRequest, Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.PostAsync("chat/completions", content);
                response.EnsureSuccessStatusCode();

                var jsonResponse = await response.Content.ReadAsStringAsync();
                var responseObject = JsonSerializer.Deserialize<JsonElement>(jsonResponse);
                
                var reply = responseObject
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                return reply ?? "Sorry, I couldn't generate a response.";
            }
            catch (HttpRequestException ex)
            {
                throw new InvalidOperationException($"Failed to get response from OpenAI API: {ex.Message}", ex);
            }
        }
    }

    public class OpenAIOptions
    {
        public const string SectionName = "OpenAI";
        
        public string ApiKey { get; set; } = string.Empty;
        public string? Model { get; set; }
        public string? SystemPrompt { get; set; }
        public int? MaxTokens { get; set; }
        public double? Temperature { get; set; }
    }
}


