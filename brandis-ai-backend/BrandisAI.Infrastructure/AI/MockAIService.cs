using System.Threading.Tasks;
using BrandisAI.Core.Interfaces;

namespace BrandisAI.Infrastructure.AI
{
    public class MockAIService : IAIService
    {
        public Task<string> GenerateResponseAsync(string userMessage, string context = null)
        {
            return Task.FromResult($"[AI]: You said: '{userMessage}'");
        }
    }
} 