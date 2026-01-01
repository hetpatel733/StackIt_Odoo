const express = require('express');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const User = require('../models/User');
const { auth, userAuth, adminAuth } = require('../middleware/auth');
const { deleteImagesFromContent } = require('./upload');
const router = express.Router();

// Get all questions
/*
Example Request:
GET /api/questions?page=1&limit=10&tags=javascript,react&search=async

Example Response:
{
  "questions": [
    {
      "_id": "64f8a1b2c3d4e5f6g7h8i9j0",
      "title": "How to use async/await in JavaScript?",
      "description": "I'm having trouble understanding async/await...",
      "tags": ["javascript", "async"],
      "userId": {
        "_id": "64f8a1b2c3d4e5f6g7h8i9j1",
        "username": "johndoe"
      },
      "acceptedAnswerId": null,
      "voteCount": 5,
      "createdAt": "2023-09-06T10:30:00.000Z"
    }
  ],
  "totalPages": 3,
  "currentPage": 1
}
*/
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, tags, search } = req.query;
    const query = {};

    if (tags) {
      query.tags = { $in: tags.split(',') };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const questions = await Question.find(query)
      .populate('userId', 'username')
      .populate('acceptedAnswerId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single question with answers
/*
Example Request:
GET /api/questions/64f8a1b2c3d4e5f6g7h8i9j0

Example Response:
{
  "_id": "64f8a1b2c3d4e5f6g7h8i9j0",
  "title": "How to use async/await in JavaScript?",
  "description": "I'm having trouble understanding async/await...",
  "tags": ["javascript", "async"],
  "userId": {
    "_id": "64f8a1b2c3d4e5f6g7h8i9j1",
    "username": "johndoe"
  },
  "answers": [
    {
      "_id": "64f8a1b2c3d4e5f6g7h8i9j2",
      "content": "Async/await is syntactic sugar for promises...",
      "userId": {
        "_id": "64f8a1b2c3d4e5f6g7h8i9j3",
        "username": "janedoe"
      },
      "voteCount": 3,
      "createdAt": "2023-09-06T11:00:00.000Z"
    }
  ],
  "acceptedAnswerId": null,
  "voteCount": 5,
  "createdAt": "2023-09-06T10:30:00.000Z"
}
*/
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('userId', 'username')
      .populate({
        path: 'answers',
        populate: { path: 'userId', select: 'username' }
      })
      .populate('acceptedAnswerId');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/questions
// Example body:
// {
//   "title": "How to use async/await in JavaScript?",
//   "description": "I'm having trouble understanding async/await syntax and how it differs from promises. Can someone explain with examples?",
//   "tags": ["javascript", "async", "promises"]
// }

router.post('/', auth, userAuth, async (req, res) => {
  try {
    const { title, description, tags } = req.body;

    // Debug log (can remove later)
    console.log("🟡 Incoming Question:", req.body);

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    // Handle tags: accept either an array or comma-separated string
    const processedTags = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags.split(',').map(tag => tag.trim())
        : [];

    const question = new Question({
      title,
      description,
      tags: processedTags,
      userId: req.user._id
    });

    await question.save();
    await question.populate('userId', 'username');

    res.status(201).json(question);
  } catch (error) {
    console.error("❌ Error creating question:", error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Vote on question
/*
Example Request:
POST /api/questions/64f8a1b2c3d4e5f6g7h8i9j0/vote?vote=1
Authorization: Bearer <token>

Note: 
- vote=1 for upvote, vote=-1 for downvote
- If user already voted the same way, it removes the vote
- If user voted differently, it switches the vote
- User ID is automatically recorded with each vote
*/
router.post('/:id/vote', auth, userAuth, async (req, res) => {
  try {
    const vote = Number(req.query.vote); // 1 for upvote, -1 for downvote
    const questionId = req.params.id;
    const userId = req.user._id;

    if (![1, -1].includes(vote)) {
      return res.status(400).json({ message: 'Vote must be 1 or -1' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user already voted
    const existingVoteIndex = question.votes.findIndex(v => v.userId.toString() === userId.toString());

    if (existingVoteIndex > -1) {
      // User has already voted
      const currentVote = question.votes[existingVoteIndex].vote;

      if (currentVote === vote) {
        // Same vote - remove it (toggle off)
        question.votes.splice(existingVoteIndex, 1);
      } else {
        // Different vote - switch from upvote to downvote or vice versa
        question.votes[existingVoteIndex].vote = vote;
      }
    } else {
      // First time voting - add new vote with user ID
      question.votes.push({ userId, vote });
    }

    await question.save();

    // Return updated vote count and user's current vote status
    const userCurrentVote = question.votes.find(v => v.userId.toString() === userId.toString());

    res.json({
      message: 'Vote recorded',
      voteCount: question.voteCount,
      userVote: userCurrentVote ? userCurrentVote.vote : null,
      totalVotes: question.votes.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Accept answer
/*
Example Request:
POST /api/questions/64f8a1b2c3d4e5f6g7h8i9j0/accept/64f8a1b2c3d4e5f6g7h8i9j2
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Note: Only the question author can accept answers

Example Response:
{
  "message": "Answer accepted successfully"
}
*/
router.post('/:id/accept/:answerId', auth, userAuth, async (req, res) => {
  try {
    console.log('Accept answer request received');
    console.log('Question ID:', req.params.id);
    console.log('Answer ID:', req.params.answerId);
    console.log('User ID from token:', req.user._id);

    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    console.log('Question author ID:', question.userId);
    console.log('Comparison result:', question.userId.toString() === req.user._id.toString());

    // Check if user is the question author
    if (question.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only question author can accept answers' });
    }

    const answer = await Answer.findById(req.params.answerId);
    if (!answer || answer.questionId.toString() !== question._id.toString()) {
      return res.status(404).json({ message: 'Answer not found for this question' });
    }

    // Check if answer is already accepted
    if (question.acceptedAnswerId) {
      return res.status(400).json({ message: 'This question already has an accepted answer' });
    }

    question.acceptedAnswerId = req.params.answerId;
    await question.save();

    console.log('Answer accepted successfully');

    // Add notification to answer author
    if (answer.userId.toString() !== req.user._id.toString()) {
      await User.findByIdAndUpdate(answer.userId, {
        $push: {
          notifications: {
            type: 'answer_accepted',
            content: `Your answer to "${question.title}" was accepted!`,
            link: `/questions/${question._id}`,
            read: false,
            createdAt: new Date()
          }
        }
      });
    }

    res.json({ message: 'Answer accepted successfully' });
  } catch (error) {
    console.error('Error accepting answer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add answer to question (moved from answers.js for correct routing)
router.post('/:id/answers', auth, userAuth, async (req, res) => {
  try {
    const { content } = req.body;
    const questionId = req.params.id;

    console.log('Received answer submission:', { content, questionId }); // Debug log

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const answer = new Answer({
      content,
      userId: req.user._id,
      questionId
    });

    await answer.save();
    await answer.populate('userId', 'username');

    // Add answer to question
    question.answers.push(answer._id);
    await question.save();

    // Add notification to question author
    if (question.userId.toString() !== req.user._id.toString()) {
      await User.findByIdAndUpdate(question.userId, {
        $push: {
          notifications: {
            type: 'question_answered',
            content: `Someone answered your question: "${question.title}"`,
            link: `/questions/${questionId}`
          }
        }
      });
    }

    res.status(201).json(answer);
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update question (user can edit their own question)
/*
Example Request:
PUT /api/questions/64f8a1b2c3d4e5f6g7h8i9j0
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "tags": ["javascript", "nodejs"]
}

Example Response:
{
  "_id": "64f8a1b2c3d4e5f6g7h8i9j0",
  "title": "Updated title",
  "description": "Updated description",
  "tags": ["javascript", "nodejs"],
  ...
}
*/
router.put('/:id', auth, userAuth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the question author
    if (question.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own questions' });
    }

    const { title, description, tags } = req.body;

    if (title !== undefined) question.title = title;
    if (description !== undefined) question.description = description;
    if (tags !== undefined) {
      question.tags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags.split(',').map(tag => tag.trim())
          : [];
    }

    await question.save();
    await question.populate('userId', 'username');

    res.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete question (user can delete their own question)
/*
Example Request:
DELETE /api/questions/64f8a1b2c3d4e5f6g7h8i9j0
Authorization: Bearer <token>

Example Response:
{
  "message": "Question deleted successfully"
}
*/
router.delete('/:id', auth, userAuth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the question author
    if (question.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own questions' });
    }

    // Delete images from question description
    await deleteImagesFromContent(question.description);

    // Get all answers and delete their images
    const answers = await Answer.find({ questionId: req.params.id });
    for (const answer of answers) {
      await deleteImagesFromContent(answer.content);
    }

    // Delete all answers for this question
    await Answer.deleteMany({ questionId: req.params.id });

    // Delete the question
    await Question.findByIdAndDelete(req.params.id);

    res.json({ message: 'Question and all its answers deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Delete question
/*
Example Request:
DELETE /api/questions/64f8a1b2c3d4e5f6g7h8i9j0/admin-delete
Authorization: Bearer <admin-token>

Example Response:
{
  "message": "Question deleted successfully"
}
*/
router.delete('/:id/admin-delete', auth, adminAuth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Delete images from question description
    await deleteImagesFromContent(question.description);

    // Get all answers and delete their images
    const answers = await Answer.find({ questionId: req.params.id });
    for (const answer of answers) {
      await deleteImagesFromContent(answer.content);
    }

    // Delete all answers for this question
    await Answer.deleteMany({ questionId: req.params.id });

    // Delete the question
    await Question.findByIdAndDelete(req.params.id);

    res.json({ message: 'Question and all its answers deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Delete specific answer
/*
Example Request:
DELETE /api/questions/64f8a1b2c3d4e5f6g7h8i9j0/answers/64f8a1b2c3d4e5f6g7h8i9j2/admin-delete
Authorization: Bearer <admin-token>

Example Response:
{
  "message": "Answer deleted successfully"
}
*/
router.delete('/:questionId/answers/:answerId/admin-delete', auth, adminAuth, async (req, res) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const answer = await Answer.findById(answerId);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Remove answer from question's answers array
    question.answers = question.answers.filter(id => id.toString() !== answerId);
    
    // If this was the accepted answer, remove the acceptance
    if (question.acceptedAnswerId && question.acceptedAnswerId.toString() === answerId) {
      question.acceptedAnswerId = null;
    }
    
    await question.save();

    // Delete images from answer content
    await deleteImagesFromContent(answer.content);

    // Delete the answer
    await Answer.findByIdAndDelete(answerId);

    res.json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
