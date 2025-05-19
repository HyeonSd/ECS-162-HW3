document.querySelector('.hyun').addEventListener('mouseover', function() {
    document.querySelector('.hyun-text h2').textContent = "Breaking News: Major Update!";
});

document.querySelector('.hyun').addEventListener('mouseout', function() {
    document.querySelector('.hyun-text h2').textContent = "Breaking News Headline Goes Here";
});

function updateDateTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    const formattedDateTime = now.toLocaleString('en-US', options);
    document.getElementById('datetime').textContent = formattedDateTime;
}

updateDateTime();

setInterval(updateDateTime, 1000);

let currentUser = null;
let currentArticleId = null;

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
            currentUser = await response.json();
            updateAuthUI();
        } else {
            updateAuthUI(false);
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        updateAuthUI(false);
    }
}

function updateAuthUI(isAuthenticated = true) {
    const authContainer = document.getElementById('auth-container');
    
    if (isAuthenticated && currentUser) {
        authContainer.innerHTML = `
            <span>Welcome, ${currentUser.name || currentUser.email}</span>
            ${currentUser.is_moderator ? '<span class="moderator-badge">Moderator</span>' : ''}
            <a href="/api/auth/logout" class="auth-button">Logout</a>
        `;
        
        if (currentUser.is_moderator) {
            const moderatorPanel = document.getElementById('moderator-panel');
            if (moderatorPanel) {
                moderatorPanel.style.display = 'block';
                loadUsers();
            }
        }
    } else {
        authContainer.innerHTML = `
            <a href="/api/auth/login" class="auth-button">Login</a>
        `;
        
        const moderatorPanel = document.getElementById('moderator-panel');
        if (moderatorPanel) {
            moderatorPanel.style.display = 'none';
        }
    }
}

async function fetchNYTArticles(page = 0) {
    try {
        const response = await fetch(`/api/news?page=${page}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API response:', data); 
        
        const articles = data.response.docs;
        const newsList = document.getElementById('news-list');
        
        if (page === 0) {
            newsList.innerHTML = '';
        }

        if (!articles || articles.length === 0) {
            newsList.innerHTML = `
                <li class="error-message">
                    <p>No articles found for Sacramento/Davis area. Try again later.</p>
                </li>
            `;
            return;
        }

        articles.forEach(article => {
            const listItem = document.createElement('li');
            listItem.className = 'article-item';

            const articleId = article._id || `nyt-${article.uri.split('/').pop()}`;
            
            let thumbnailUrl = '';
            if (article.multimedia && article.multimedia.length > 0) {
                const multimedia = article.multimedia.find(m => m.type === 'image');
                if (multimedia) {
                    thumbnailUrl = `https://www.nytimes.com/${multimedia.url}`;
                }
            }
            
            listItem.innerHTML = `
                <div class="article-content">
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${article.headline.main}" class="article-image">` : ''}
                    <div class="article-text">
                        <h3><a href="${article.web_url}" target="_blank">${article.headline.main}</a></h3>
                        <p>${article.snippet}</p>
                        <small>Published: ${new Date(article.pub_date).toLocaleDateString()}</small>
                    </div>
                </div>
                <div class="article-actions">
                    <button class="comment-button" data-article-id="${articleId}">Comments</button>
                </div>
                <div class="comments-container" id="comments-${articleId}" style="display: none;">
                    <div class="comments-list" id="comments-list-${articleId}"></div>
                    <div class="comment-form-container" id="comment-form-${articleId}"></div>
                </div>
            `;
            newsList.appendChild(listItem);
            
            listItem.querySelector('.comment-button').addEventListener('click', function() {
                const articleId = this.getAttribute('data-article-id');
                toggleComments(articleId);
            });
        });

        if (articles.length > 0) {
            const loadMoreContainer = document.getElementById('load-more-container');
            if (!loadMoreContainer) {
                const container = document.createElement('div');
                container.id = 'load-more-container';
                container.innerHTML = `
                    <button id="load-more-button">Load More</button>
                `;
                newsList.parentNode.appendChild(container);
                
                document.getElementById('load-more-button').addEventListener('click', function() {
                    fetchNYTArticles(page + 1);
                });
            }
        }

    } catch (error) {
        console.error('Error fetching news:', error);
        document.getElementById('news-list').innerHTML = `
            <li class="error-message">
                <p>Failed to load news. Please try again later.</p>
                <small>Error details: ${error.message}</small>
            </li>
        `;
    }
}

async function toggleComments(articleId) {
    currentArticleId = articleId;
    const commentContainer = document.getElementById(`comments-${articleId}`);
    
    if (commentContainer.style.display === 'none') {
        commentContainer.style.display = 'block';
        await fetchComments(articleId);
        renderCommentForm(articleId);
    } else {
        commentContainer.style.display = 'none';
    }
}

async function fetchComments(articleId) {
    try {
        const response = await fetch(`/api/comments/${articleId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
        }
        
        const comments = await response.json();
        
        renderComments(articleId, comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        document.getElementById(`comments-list-${articleId}`).innerHTML = `
            <div class="error-message">Failed to load comments. Please try again later.</div>
        `;
    }
}

function renderComments(articleId, comments) {
    const commentsList = document.getElementById(`comments-list-${articleId}`);
    
    if (comments.length === 0) {
        commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
        return;
    }
    
    const commentsMap = new Map();
    comments.forEach(comment => {
        if (!commentsMap.has(comment._id)) {
            commentsMap.set(comment._id, { ...comment, replies: [] });
        }
    });
    
    const rootComments = [];
    comments.forEach(comment => {
        if (comment.parent_id) {
            const parentComment = commentsMap.get(comment.parent_id);
            if (parentComment) {
                parentComment.replies.push(commentsMap.get(comment._id));
            } else {
                rootComments.push(commentsMap.get(comment._id));
            }
        } else {
            rootComments.push(commentsMap.get(comment._id));
        }
    });

    rootComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    commentsList.innerHTML = '';
    rootComments.forEach(comment => {
        const commentElement = renderCommentElement(comment, 0);
        commentsList.appendChild(commentElement);
    });
}

function renderCommentElement(comment, depth) {
    const div = document.createElement('div');
    div.className = `comment depth-${depth}`;
    div.setAttribute('data-comment-id', comment._id);
    
    const isRemoved = comment.is_removed;
    const isCurrentUserModerator = currentUser && currentUser.is_moderator;
    
    const commentDate = new Date(comment.created_at).toLocaleString();
    
    div.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${comment.author.name || comment.author.email}</span>
            <span class="comment-date">${commentDate}</span>
        </div>
        <div class="comment-content">${comment.content}</div>
        <div class="comment-actions">
            ${currentUser ? `<button class="reply-button" data-comment-id="${comment._id}">Reply</button>` : ''}
            ${isCurrentUserModerator && !isRemoved ? `
                <button class="remove-button" data-comment-id="${comment._id}">Remove</button>
                <button class="redact-button" data-comment-id="${comment._id}">Redact</button>
            ` : ''}
        </div>
        <div class="reply-form-container" id="reply-form-${comment._id}" style="display: none;"></div>
        <div class="comment-replies" id="replies-${comment._id}"></div>
    `;
    
    setTimeout(() => {

        const replyButton = div.querySelector('.reply-button');
        if (replyButton) {
            replyButton.addEventListener('click', function() {
                const commentId = this.getAttribute('data-comment-id');
                toggleReplyForm(commentId);
            });
        }
        
        const removeButton = div.querySelector('.remove-button');
        if (removeButton) {
            removeButton.addEventListener('click', function() {
                const commentId = this.getAttribute('data-comment-id');
                removeComment(commentId);
            });
        }

        const redactButton = div.querySelector('.redact-button');
        if (redactButton) {
            redactButton.addEventListener('click', function() {
                const commentId = this.getAttribute('data-comment-id');
                showRedactForm(commentId, comment.content);
            });
        }
        
        const repliesContainer = div.querySelector(`#replies-${comment._id}`);
        if (comment.replies && comment.replies.length > 0) {
            comment.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            comment.replies.forEach(reply => {
                const replyElement = renderCommentElement(reply, depth + 1);
                repliesContainer.appendChild(replyElement);
            });
        }
    }, 0);
    
    return div;
}

function toggleReplyForm(commentId) {
    const replyFormContainer = document.getElementById(`reply-form-${commentId}`);
    
    if (replyFormContainer.style.display === 'none') {
        replyFormContainer.style.display = 'block';
        replyFormContainer.innerHTML = `
            <form class="comment-form" id="reply-form-${commentId}-form">
                <textarea name="content" placeholder="Write your reply..." required></textarea>
                <div class="form-actions">
                    <button type="submit">Submit</button>
                    <button type="button" class="cancel-button">Cancel</button>
                </div>
            </form>
        `;

        document.getElementById(`reply-form-${commentId}-form`).addEventListener('submit', function(e) {
            e.preventDefault();
            submitReply(commentId, this.elements.content.value);
        });
        
        replyFormContainer.querySelector('.cancel-button').addEventListener('click', function() {
            replyFormContainer.style.display = 'none';
        });
    } else {
        replyFormContainer.style.display = 'none';
    }
}

async function submitReply(commentId, content) {
    if (!currentUser) {
        alert('You must be logged in to reply to comments.');
        return;
    }
    
    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                article_id: currentArticleId,
                parent_id: commentId,
                content: content
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to submit reply: ${response.status} ${response.statusText}`);
        }
        
        fetchComments(currentArticleId);
        
        document.getElementById(`reply-form-${commentId}`).style.display = 'none';
    } catch (error) {
        console.error('Error submitting reply:', error);
        alert('Failed to submit reply. Please try again later.');
    }
}

function renderCommentForm(articleId) {
    const formContainer = document.getElementById(`comment-form-${articleId}`);
    
    if (!currentUser) {
        formContainer.innerHTML = `
            <div class="login-prompt">
                <p>Please <a href="/api/auth/login">login</a> to leave a comment.</p>
            </div>
        `;
        return;
    }
    
    formContainer.innerHTML = `
        <form class="comment-form" id="comment-form-${articleId}-form">
            <h3>Leave a Comment</h3>
            <textarea name="content" placeholder="Write your comment..." required></textarea>
            <button type="submit">Submit</button>
        </form>
    `;
    
    document.getElementById(`comment-form-${articleId}-form`).addEventListener('submit', function(e) {
        e.preventDefault();
        submitComment(articleId, this.elements.content.value);
    });
}

async function submitComment(articleId, content) {
    if (!currentUser) {
        alert('You must be logged in to comment.');
        return;
    }
    
    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                article_id: articleId,
                content: content
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to submit comment: ${response.status} ${response.statusText}`);
        }

        fetchComments(articleId);
        
        document.getElementById(`comment-form-${articleId}-form`).elements.content.value = '';
    } catch (error) {
        console.error('Error submitting comment:', error);
        alert('Failed to submit comment. Please try again later.');
    }
}

async function removeComment(commentId) {
    if (!currentUser || !currentUser.is_moderator) {
        alert('You must be a moderator to remove comments.');
        return;
    }
    
    if (!confirm('Are you sure you want to remove this comment?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to remove comment: ${response.status} ${response.statusText}`);
        }
        
        fetchComments(currentArticleId);
    } catch (error) {
        console.error('Error removing comment:', error);
        alert('Failed to remove comment. Please try again later.');
    }
}

function showRedactForm(commentId, commentContent) {
    let redactModal = document.getElementById('redact-modal');
    
    if (!redactModal) {
        redactModal = document.createElement('div');
        redactModal.id = 'redact-modal';
        redactModal.className = 'modal';
        redactModal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>Redact Comment</h3>
                <p class="instructions">Select text to redact and click "Redact Selected"</p>
                
                <textarea id="redact-text" class="redact-textarea"></textarea>
                
                <div class="modal-actions">
                    <button id="redact-selected-btn" class="redact-button">Redact Selected</button>
                    <button id="save-redact-btn" class="submit-button">Save Changes</button>
                    <button id="cancel-redact-btn" class="cancel-button">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(redactModal);
    }
    
    redactModal.style.display = 'block';
    
    const textarea = document.getElementById('redact-text');
    textarea.value = commentContent;
    

    redactModal.setAttribute('data-comment-id', commentId);

    document.querySelector('.close-button').addEventListener('click', function() {
        redactModal.style.display = 'none';
    });
    
    document.getElementById('redact-selected-btn').addEventListener('click', function() {
        const selectedText = textarea.value.substring(
            textarea.selectionStart,
            textarea.selectionEnd
        );
        
        if (selectedText) {
            const beforeSelection = textarea.value.substring(0, textarea.selectionStart);
            const afterSelection = textarea.value.substring(textarea.selectionEnd);
            textarea.value = beforeSelection + '█'.repeat(selectedText.length) + afterSelection;
        }
    });
    
    document.getElementById('cancel-redact-btn').addEventListener('click', function() {
        redactModal.style.display = 'none';
    });
    
    document.getElementById('save-redact-btn').addEventListener('click', function() {
        const commentId = redactModal.getAttribute('data-comment-id');
        submitRedaction(commentId, textarea.value, commentContent);
        redactModal.style.display = 'none';
    });
}

async function submitRedaction(commentId, redactedContent, originalContent) {
    try {
        let redactText = '';
        for (let i = 0; i < originalContent.length && i < redactedContent.length; i++) {
            if (originalContent[i] !== redactedContent[i]) {
                const start = i;
                
                let originalEnd = start;
                while (originalEnd < originalContent.length && originalContent[originalEnd] !== redactedContent[originalEnd]) {
                    originalEnd++;
                }
                
                redactText = originalContent.substring(start, originalEnd);
                break;
            }
        }
        
        if (!redactText) {
            alert('No text was redacted.');
            return;
        }
        
        const response = await fetch(`/api/comments/${commentId}/redact`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                redact_text: redactText
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to redact comment: ${response.status} ${response.statusText}`);
        }
        
        fetchComments(currentArticleId);
    } catch (error) {
        console.error('Error redacting comment:', error);
        alert('Failed to redact comment. Please try again later.');
    }
}

async function loadUsers() {
    if (!currentUser || !currentUser.is_moderator) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/users');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }
        
        const users = await response.json();
        
        const usersList = document.getElementById('users-list');
        if (!usersList) return;
        
        usersList.innerHTML = '';
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-info">
                    <span class="user-name">${user.name || 'Unknown'}</span>
                    <span class="user-email">${user.email}</span>
                    ${user.is_moderator ? '<span class="moderator-badge small">Moderator</span>' : ''}
                </div>
                <div class="user-actions">
                    ${user.is_moderator ? 
                        `<button class="demote-button" data-email="${user.email}">Demote from Moderator</button>` : 
                        `<button class="promote-button" data-email="${user.email}">Promote to Moderator</button>`
                    }
                </div>
            `;
            
            usersList.appendChild(userItem);
            
            const promoteButton = userItem.querySelector('.promote-button');
            if (promoteButton) {
                promoteButton.addEventListener('click', function() {
                    const email = this.getAttribute('data-email');
                    promoteUser(email);
                });
            }
            
            const demoteButton = userItem.querySelector('.demote-button');
            if (demoteButton) {
                demoteButton.addEventListener('click', function() {
                    const email = this.getAttribute('data-email');
                    demoteUser(email);
                });
            }
        });
    } catch (error) {
        console.error('Error loading users:', error);
        const usersList = document.getElementById('users-list');
        if (usersList) {
            usersList.innerHTML = `<div class="error-message">Failed to load users. Please try again later.</div>`;
        }
    }
}

async function promoteUser(email) {
    if (!currentUser || !currentUser.is_moderator) {
        alert('You must be a moderator to promote users.');
        return;
    }
    
    if (!confirm(`Are you sure you want to promote ${email} to moderator?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${email}/promote`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to promote user: ${response.status} ${response.statusText}`);
        }
        
        loadUsers();
    } catch (error) {
        console.error('Error promoting user:', error);
        alert('Failed to promote user. Please try again later.');
    }
}

async function demoteUser(email) {
    if (!currentUser || !currentUser.is_moderator) {
        alert('You must be a moderator to demote users.');
        return;
    }
    
    if (email === currentUser.email) {
        alert('You cannot demote yourself.');
        return;
    }
    
    if (!confirm(`Are you sure you want to demote ${email} from moderator?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${email}/demote`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to demote user: ${response.status} ${response.statusText}`);
        }

        loadUsers();
    } catch (error) {
        console.error('Error demoting user:', error);
        alert('Failed to demote user. Please try again later.');
    }
}


document.addEventListener('DOMContentLoaded', function() {
    
    checkAuth();
    
    fetchNYTArticles();
    
    console.log('API URL: /api/news');
});