using System;
using System.Collections.Generic;

namespace BrandisAI.Core.Models
{
    public class Discussion
    {
        public Guid Id { get; set; }
        public string? Title { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<Message> Messages { get; set; } = new List<Message>();
        public string? UserId { get; set; }  // We'll use string for now, can be changed based on auth provider
    }
} 