import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const Signup = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // Ideally, you would also save the user's name to their profile or a database here
            navigate('/'); // Redirect to home/dashboard after successful signup
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setError('');
        try {
            await signInWithPopup(auth, googleProvider);
            navigate('/');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4">
            <div className="flex min-h-[600px] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                {/* Left Side - Illustration */}
                <div className="relative hidden w-1/2 flex-col items-center justify-center bg-blue-50 p-10 md:flex">
                    <div className="absolute top-10 left-10 h-12 w-12 rounded-full bg-orange-200 opacity-50"></div>
                    <div className="absolute bottom-20 right-10 h-20 w-20 rounded-full bg-blue-200 opacity-50"></div>

                    {/* Placeholder for the illustration */}
                    <img
                        src="https://img.freepik.com/free-vector/mobile-login-concept-illustration_114360-83.jpg?w=740&t=st=1709280000~exp=1709280600~hmac=..."
                        alt="Sign up illustration"
                        className="z-10 max-w-xs object-contain mix-blend-multiply"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                    />
                    <div className="hidden h-64 w-64 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                        <User size={64} />
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="flex w-full flex-col justify-center p-8 md:w-1/2 md:p-12">
                    <div className="mb-8 text-left">
                        <h2 className="text-4xl font-bold text-gray-800">Sign up</h2>
                    </div>

                    {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

                    <form className="space-y-6" onSubmit={handleSignup}>
                        <div className="relative border-b border-gray-300 py-2">
                            <User className="absolute left-0 top-3 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-transparent py-2 pl-8 pr-4 text-gray-700 placeholder-gray-400 focus:outline-none"
                                required
                            />
                        </div>

                        <div className="relative border-b border-gray-300 py-2">
                            <User className="absolute left-0 top-3 text-gray-400" size={20} />
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-transparent py-2 pl-8 pr-4 text-gray-700 placeholder-gray-400 focus:outline-none"
                                required
                            />
                        </div>

                        <div className="relative border-b border-gray-300 py-2">
                            <Lock className="absolute left-0 top-3 text-gray-400" size={20} />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-transparent py-2 pl-8 pr-10 text-gray-700 placeholder-gray-400 focus:outline-none"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-3 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-500">
                                Remember me
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-40 rounded-lg bg-blue-400 px-4 py-3 font-semibold text-white shadow-md transition duration-300 hover:bg-blue-500 hover:shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'Signing up...' : 'Sign up'}
                        </button>
                    </form>

                    <div className="mt-10 flex flex-col items-center justify-between space-y-4 text-sm text-gray-500 sm:flex-row sm:space-y-0">
                        <Link to="/signin" className="underline hover:text-gray-800">
                            Already have an account?
                        </Link>

                        <div className="flex items-center space-x-2">
                            <span>Or sign up with</span>
                            <button
                                onClick={handleGoogleSignup}
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
