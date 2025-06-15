using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using BrandisAI.Application.Services;
using BrandisAI.Core.Models;
using BrandisAI.API.DTOs;

namespace BrandisAI.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DiscussionsController : ControllerBase
    {
        private readonly DiscussionService _discussionService;

        public DiscussionsController(DiscussionService discussionService)
        {
            _discussionService = discussionService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var discussions = await _discussionService.GetAllDiscussionsAsync();
            return Ok(discussions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var discussion = await _discussionService.GetDiscussionByIdAsync(id);
            if (discussion == null) return NotFound();
            return Ok(discussion);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDiscussionRequest request)
        {
            var discussion = new Discussion
            {
                Title = request.Title,
                UserId = request.UserId
            };
            var created = await _discussionService.CreateDiscussionAsync(discussion);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPost("{id}/messages")]
        public async Task<IActionResult> AddMessage(Guid id, [FromBody] CreateMessageRequest request)
        {
            var message = new Message
            {
                Content = request.Content,
                IsFromAI = false,
                DiscussionId = id
            };
            var added = await _discussionService.AddMessageAsync(id, message);
            if (added == null) return NotFound();
            return Ok(added);
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var deleted = await _discussionService.DeleteDiscussionAsync(id);
            if (!deleted) return NotFound();
            return NoContent();
        }
    }
} 