using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BrandisAI.Core.Interfaces;
using BrandisAI.Core.Models;

namespace BrandisAI.Application.Services
{
    public class DiscussionService
    {
        private readonly IDiscussionRepository _discussionRepository;
        private readonly IAIService _aiService;

        public DiscussionService(IDiscussionRepository discussionRepository, IAIService aiService)
        {
            _discussionRepository = discussionRepository;
            _aiService = aiService;
        }

        public Task<IEnumerable<Discussion>> GetAllDiscussionsAsync() => _discussionRepository.GetAllAsync();

        public Task<Discussion> GetDiscussionByIdAsync(Guid id) => _discussionRepository.GetByIdAsync(id);

        public Task<Discussion> CreateDiscussionAsync(Discussion discussion) => _discussionRepository.CreateAsync(discussion);

        public async Task<Message> AddMessageAsync(Guid discussionId, Message message)
        {
            var addedMessage = await _discussionRepository.AddMessageAsync(discussionId, message);
            if (!message.IsFromAI)
            {
                var aiResponse = await _aiService.GenerateResponseAsync(message.Content);
                var aiMessage = new Message
                {
                    Id = Guid.NewGuid(),
                    Content = aiResponse,
                    CreatedAt = DateTime.UtcNow,
                    IsFromAI = true,
                    DiscussionId = discussionId
                };
                await _discussionRepository.AddMessageAsync(discussionId, aiMessage);
            }
            return addedMessage;
        }

        public async Task<bool> DeleteDiscussionAsync(Guid id)
        {
            return await _discussionRepository.DeleteAsync(id);
        }
    }
} 