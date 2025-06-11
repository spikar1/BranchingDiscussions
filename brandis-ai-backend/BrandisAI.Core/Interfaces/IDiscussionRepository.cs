using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BrandisAI.Core.Models;

namespace BrandisAI.Core.Interfaces
{
    public interface IDiscussionRepository
    {
        Task<Discussion> GetByIdAsync(Guid id);
        Task<IEnumerable<Discussion>> GetAllAsync();
        Task<Discussion> CreateAsync(Discussion discussion);
        Task<Discussion> UpdateAsync(Discussion discussion);
        Task<bool> DeleteAsync(Guid id);
        Task<Message> AddMessageAsync(Guid discussionId, Message message);
    }
} 