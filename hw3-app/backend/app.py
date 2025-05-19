@app.template_filter('datetimeformat')
def datetimeformat(value, format='%B %d, %Y'):
    if isinstance(value, str):
        try:
            value = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
        except:
            return value
    return value.strftime(format)

@app.route('/')
def home():
    page = request.args.get('page', 0, type=int)
    
    user = None
    if 'user' in session:
        user = session['user']
        user_email = user.get('email')
        user_in_db = users_collection.find_one({'email': user_email})
        if user_in_db:
            user['is_moderator'] = user_in_db.get('is_moderator', False)

    try:
        params = {
            'api-key': NYT_API_KEY,
            'q': 'Sacramento OR Davis',
            'fq': 'glocations:("CALIFORNIA")',
            'page': page,
            'sort': 'newest'
        }
        
        response = requests.get(NYT_BASE_URL, params=params)
        data = response.json()
        
        if response.status_code != 200:
            articles = []
            error_message = "Failed to fetch news from NYT API"
        else:
            articles = data['response']['docs']
            error_message = None
    except Exception as e:
        articles = []
        error_message = str(e)
    
    now = datetime.datetime.now()

    has_more = len(articles) >= 10  
    
    return render_template('index.html', 
                          user=user, 
                          articles=articles, 
                          error_message=error_message,
                          now=now,
                          current_page=page,
                          has_more=has_more)

@app.route('/article/<article_id>')
def article_details(article_id):
    user = None
    if 'user' in session:
        user = session['user']
        user_email = user.get('email')
        user_in_db = users_collection.find_one({'email': user_email})
        if user_in_db:
            user['is_moderator'] = user_in_db.get('is_moderator', False)

    try:
        params = {
            'api-key': NYT_API_KEY,
            'fq': f'_id:("{article_id}")'
        }
        
        response = requests.get(NYT_BASE_URL, params=params)
        data = response.json()
        
        if response.status_code != 200 or len(data['response']['docs']) == 0:
            return redirect(url_for('home'))
        
        article = data['response']['docs'][0]
    except Exception as e:
        return redirect(url_for('home'))
    
    comments = list(comments_collection.find({'article_id': article_id}).sort('created_at', -1))
    
    for comment in comments:
        comment['_id'] = str(comment['_id'])
        if comment.get('parent_id'):
            comment['parent_id'] = str(comment['parent_id'])

    now = datetime.datetime.now()
    
    return render_template('article.html', 
                          article=article,
                          comments=comments,
                          user=user,
                          now=now)

@app.route('/submit_comment', methods=['POST'])
@login_required
def submit_comment():
    article_id = request.form.get('article_id')
    content = request.form.get('content')
    parent_id = request.form.get('parent_id')
    
    new_comment = {
        'article_id': article_id,
        'content': content,
        'author': {
            'email': session['user']['email'],
            'name': session['user'].get('name', 'Anonymous')
        },
        'created_at': datetime.datetime.now(),
        'is_removed': False
    }
    
    if parent_id:
        new_comment['parent_id'] = ObjectId(parent_id)
    
    comments_collection.insert_one(new_comment)
    
    return redirect(url_for('article_details', article_id=article_id))

@app.route('/remove_comment/<comment_id>', methods=['POST'])
@login_required
@moderator_required
def remove_comment_route(comment_id):
    comments_collection.update_one(
        {'_id': ObjectId(comment_id)},
        {'$set': {'is_removed': True, 'content': 'COMMENT REMOVED BY MODERATOR!'}}
    )

    comment = comments_collection.find_one({'_id': ObjectId(comment_id)})
    article_id = comment['article_id']
    
    return redirect(url_for('article_details', article_id=article_id))

@app.route('/redact_comment/<comment_id>', methods=['POST'])
@login_required
@moderator_required
def redact_comment_route(comment_id):
    redact_text = request.form.get('redact_text')
    
    comment = comments_collection.find_one({'_id': ObjectId(comment_id)})
    
    if not comment:
        return redirect(url_for('home'))

    redacted_content = comment['content'].replace(
        redact_text, 
        '█' * len(redact_text)
    )
    
    comments_collection.update_one(
        {'_id': ObjectId(comment_id)},
        {'$set': {'content': redacted_content}}
    )
    
    return redirect(url_for('article_details', article_id=comment['article_id']))

@app.route('/admin/users')
@login_required
@moderator_required
def admin_users():
    user = None
    if 'user' in session:
        user = session['user']
        user_email = user.get('email')
        user_in_db = users_collection.find_one({'email': user_email})
        if user_in_db:
            user['is_moderator'] = user_in_db.get('is_moderator', False)
    
    users = list(users_collection.find({}, {'hash': 0}))
    
    for user_item in users:
        if '_id' in user_item:
            user_item['_id'] = str(user_item['_id'])
    
    now = datetime.datetime.now()
    
    return render_template('admin_users.html', 
                          users=users,
                          user=user,
                          now=now)

@app.route('/admin/users/<email>/promote', methods=['POST'])
@login_required
@moderator_required
def promote_user_route(email):
    users_collection.update_one(
        {'email': email},
        {'$set': {'is_moderator': True}}
    )
    return redirect(url_for('admin_users'))

@app.route('/admin/users/<email>/demote', methods=['POST'])
@login_required
@moderator_required
def demote_user_route(email):
    if session['user']['email'] == email:
        return redirect(url_for('admin_users'))
        
    users_collection.update_one(
        {'email': email},
        {'$set': {'is_moderator': False}}
    )
    return redirect(url_for('admin_users'))

@app.route('/login')
def login():
    session['nonce'] = nonce
    redirect_uri = url_for('authorize', _external=True)
    return oauth.flask_app.authorize_redirect(redirect_uri, nonce=nonce)
