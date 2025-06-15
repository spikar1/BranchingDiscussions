using System;

namespace BrandisAI.Core.Models
{
    public class Message
    {
        public Guid Id { get; set; }
        public string? Content { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsFromAI { get; set; }
        public Guid DiscussionId { get; set; }
    }
} 