using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BrandisAI.Core.Interfaces;
using BrandisAI.Core.Models;

namespace BrandisAI.Infrastructure.Repositories
{
    public class InMemoryDiscussionRepository : IDiscussionRepository
    {
        private readonly ConcurrentDictionary<Guid, Discussion> _discussions = new();

        public Task<Discussion?> GetByIdAsync(Guid id)
        {
            _discussions.TryGetValue(id, out var discussion);
            return Task.FromResult(discussion);
        }

        public Task<IEnumerable<Discussion>> GetAllAsync()
        {
            return Task.FromResult(_discussions.Values.AsEnumerable());
        }

        public Task<Discussion> CreateAsync(Discussion discussion)
        {
            discussion.Id = Guid.NewGuid();
            discussion.CreatedAt = DateTime.UtcNow;
            _discussions[discussion.Id] = discussion;
            return Task.FromResult(discussion);
        }

        public Task<Discussion> UpdateAsync(Discussion discussion)
        {
            _discussions[discussion.Id] = discussion;
            return Task.FromResult(discussion);
        }

        public Task<bool> DeleteAsync(Guid id)
        {
            return Task.FromResult(_discussions.TryRemove(id, out _));
        }

        public Task<Message?> AddMessageAsync(Guid discussionId, Message message)
        {
            if (_discussions.TryGetValue(discussionId, out var discussion))
            {
                message.Id = Guid.NewGuid();
                message.CreatedAt = DateTime.UtcNow;
                discussion.Messages.Add(message);
                return Task.FromResult<Message?>(message);
            }
            return Task.FromResult<Message?>(null);
        }
    }
} 