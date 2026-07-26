# HSK Chinese Learning Platform

A comprehensive Next.js application for learning Chinese vocabulary and preparing for the HSK exam.

## Features

### 🆓 Free Features
- **Dictionary Search**: Search through comprehensive Chinese dictionaries
- **Text Translator**: Translate between Chinese, Russian, English, and Turkmen
- **Learning Mode**: Interactive flashcards for vocabulary practice
- **6 Example Sentences**: Per word for free users

### ⭐ Premium Features
- **10 Example Sentences**: Per word for premium users
- **Personal Dictionaries**: Create and manage your own word lists
- **Search History**: Track your search history
- **Priority Support**: Get help when you need it

### 🔐 User Features
- **Account System**: Register and login with email
- **Profile Management**: Update name, avatar, and password
- **Search History**: View your recent searches
- **Premium Subscription**: Upgrade for advanced features

### 👨‍💼 Admin Features
- **User Management**: View and manage all users
- **Premium Management**: Grant premium access to users
- **Admin Controls**: Full administrative access

## Installation

### Prerequisites
- Node.js 14+ and npm/yarn
- MongoDB database (local or MongoDB Atlas)

### Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd hsk-original
npm install
# or
yarn install
```

### Step 2: Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hsk-app
JWT_SECRET=your-random-secret-key-here
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
OPENAI_API_KEY=your-openai-api-key (optional)
```

### Step 3: Set Up MongoDB

#### Option A: MongoDB Atlas (Recommended for Vercel)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (free tier available)
4. Create a database user
5. Whitelist your IP address (or use 0.0.0.0/0 for Vercel)
6. Get your connection string and add it to `.env.local`

#### Option B: Local MongoDB

1. Install MongoDB locally
2. Start MongoDB service
3. Use `mongodb://localhost:27017/hsk-app` as your `MONGODB_URI`

### Step 4: Set Up Google reCAPTCHA

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register a new site
3. Choose reCAPTCHA v2
4. Add your domain (localhost for development)
5. Copy Site Key and Secret Key to `.env.local`

### Step 5: Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Add environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
   - `RECAPTCHA_SECRET_KEY`
   - `OPENAI_API_KEY` (optional)

### Step 3: Configure MongoDB Atlas for Vercel

1. In MongoDB Atlas, go to Network Access
2. Add IP address: `0.0.0.0/0` (allows all IPs)
3. Or add Vercel's IP ranges

### Step 4: Update reCAPTCHA Domain

1. In Google reCAPTCHA Admin, add your Vercel domain
2. Update `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` if needed

## Creating the First Admin User

After deployment, you need to create an admin user. You can do this by:

1. Register a new account through the website
2. Connect to your MongoDB database
3. Update the user document to set `isAdmin: true`:

```javascript
// In MongoDB shell or MongoDB Compass
db.users.updateOne(
  { email: "your-admin@email.com" },
  { $set: { isAdmin: true } }
)
```

## Project Structure

```
hsk-original/
├── components/          # React components
│   ├── Auth/           # Authentication components
│   ├── Search/         # Search components
│   └── ...
├── lib/                # Utility libraries
│   ├── contexts/       # React contexts
│   ├── models/         # Database models
│   └── ...
├── pages/              # Next.js pages
│   ├── api/           # API routes
│   ├── admin/         # Admin pages
│   └── ...
├── words/             # Dictionary data files
└── styles/            # SCSS styles
```

## API Routes

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user
- `GET /api/search?q=...` - Search dictionary
- `GET /api/search/examples?word=...` - Get example sentences
- `POST /api/translate` - Translate text
- `PUT /api/user/profile` - Update profile
- `PUT /api/user/password` - Change password
- `GET /api/admin/users` - Get all users (admin only)
- `PUT /api/admin/users/[id]` - Update user (admin only)
- `DELETE /api/admin/users/[id]` - Delete user (admin only)

## Technologies Used

- **Next.js 9.3.5** - React framework
- **React 16.13.1** - UI library
- **MongoDB** - Database
- **Bootstrap/Reactstrap** - UI components
- **bcryptjs** - Password hashing
- **jsonwebtoken** - Authentication
- **axios** - HTTP client
- **react-google-recaptcha** - CAPTCHA

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
