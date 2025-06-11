using System.Threading.Tasks;

namespace BrandisAI.Core.Interfaces
{
    public interface IAIService
    {
        Task<string> GenerateResponseAsync(string userMessage, string context = null);
    }
} 