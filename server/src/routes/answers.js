const express = require('express');
const Answer = require('../models/Answer');
const Question = require('../models/Question');
const User = require('../models/User');
const { auth, userAuth } = require('../middleware/auth');
const { deleteImagesFromContent } = require('./upload');
const router = express.Router();

// Post answer to question
/*
Example Request:
POST /api/answers/questions/64f8a1b2c3d4e5f6g7h8i9j0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "content": "Async/await is syntactic sugar for promises. Here's how it works:\n\n```javascript\nasync function fetchData() {\n  try {\n    const response = await fetch('/api/data');\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error('Error:', error);\n  }\n}\n```"
}

Example Response:
{
  "_id": "64f8a1b2c3d4e5f6g7h8i9j2",
  "content": "Async/await is syntactic sugar for promises...",
  "userId": {
    "_id": "64f8a1b2c3d4e5f6g7h8i9j3",
    "username": "janedoe"
  },
  "questionId": "64f8a1b2c3d4e5f6g7h8i9j0",
  "votes": [],
  "voteCount": 0,
  "createdAt": "2023-09-06T11:00:00.000Z"
}
*/
router.post('/questions/:questionId', auth, userAuth, async (req, res) => {
  try {
    const { content } = req.body; // Changed from req.query to req.body
    const questionId = req.params.questionId;

    console.log('Received answer submission:', { content, questionId }); // Debug log

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Prevent users from answering their own questions
    if (question.userId.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot answer your own question' });
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

// Vote on answer
/*
Example Request:
POST /api/answers/64f8a1b2c3d4e5f6g7h8i9j2/vote?vote=1
Authorization: Bearer <token>

Note: 
- vote=1 for upvote, vote=-1 for downvote
- If user already voted the same way, it removes the vote
- If user voted differently, it switches the vote
- User ID is automatically recorded with each vote
*/
router.post('/:id/vote', auth, userAuth, async (req, res) => {
  try {
    const vote = Number(req.query.vote);
    const answerId = req.params.id;
    const userId = req.user._id; // Use authenticated user ID

    if (![1, -1].includes(vote)) {
      return res.status(400).json({ message: 'Vote must be 1 or -1' });
    }

    const answer = await Answer.findById(answerId);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Check if user already voted
    const existingVoteIndex = answer.votes.findIndex(v => v.userId.toString() === userId.toString());

    if (existingVoteIndex > -1) {
      // User has already voted
      const currentVote = answer.votes[existingVoteIndex].vote;
      
      if (currentVote === vote) {
        // Same vote - remove it (toggle off)
        answer.votes.splice(existingVoteIndex, 1);
      } else {
        // Different vote - switch from upvote to downvote or vice versa
        answer.votes[existingVoteIndex].vote = vote;
      }
    } else {
      // First time voting - add new vote with user ID
      answer.votes.push({ userId, vote });
    }

    await answer.save();
    
    // Return updated vote count and user's current vote status
    const userCurrentVote = answer.votes.find(v => v.userId.toString() === userId.toString());
    
    res.json({ 
      message: 'Vote recorded', 
      voteCount: answer.voteCount,
      userVote: userCurrentVote ? userCurrentVote.vote : null,
      totalVotes: answer.votes.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update answer (user can edit their own answer, but not if it's accepted)
/*
Example Request:
PUT /api/answers/64f8a1b2c3d4e5f6g7h8i9j2
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated answer content"
}

Example Response:
{
  "_id": "64f8a1b2c3d4e5f6g7h8i9j2",
  "content": "Updated answer content",
  ...
}
*/
router.put('/:id', auth, userAuth, async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Check if user is the answer author
    if (answer.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own answers' });
    }

    // Check if this answer is accepted
    const question = await Question.findById(answer.questionId);
    if (question && question.acceptedAnswerId && question.acceptedAnswerId.toString() === answer._id.toString()) {
      return res.status(403).json({ message: 'Cannot edit an accepted answer' });
    }

    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    answer.content = content;
    await answer.save();
    await answer.populate('userId', 'username');

    res.json(answer);
  } catch (error) {
    console.error('Error updating answer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete answer (user can delete their own answer, but not if it's accepted)
/*
Example Request:
DELETE /api/answers/64f8a1b2c3d4e5f6g7h8i9j2
Authorization: Bearer <token>

Example Response:
{
  "message": "Answer deleted successfully"
}
*/
router.delete('/:id', auth, userAuth, async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Check if user is the answer author
    if (answer.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own answers' });
    }

    // Check if this answer is accepted
    const question = await Question.findById(answer.questionId);
    if (question && question.acceptedAnswerId && question.acceptedAnswerId.toString() === answer._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete an accepted answer' });
    }

    // Remove answer from question's answers array
    if (question) {
      question.answers = question.answers.filter(id => id.toString() !== req.params.id);
      await question.save();
    }

    // Delete images from answer content
    await deleteImagesFromContent(answer.content);

    // Delete the answer
    await Answer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Delete specific answer
/*
Example Request:
DELETE /api/answers/64f8a1b2c3d4e5f6g7h8i9j2/admin-delete
Authorization: Bearer <admin-token>

Example Response:
{
  "message": "Answer deleted successfully"
}
*/
router.delete('/:answerId/admin-delete', auth, async (req, res) => {
  try {
    const { answerId } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const answer = await Answer.findById(answerId);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const question = await Question.findById(answer.questionId);
    if (question) {
      // Remove answer from question's answers array
      question.answers = question.answers.filter(id => id.toString() !== answerId);
      
      // If this was the accepted answer, remove the acceptance
      if (question.acceptedAnswerId && question.acceptedAnswerId.toString() === answerId) {
        question.acceptedAnswerId = null;
      }
      
      await question.save();
    }

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
