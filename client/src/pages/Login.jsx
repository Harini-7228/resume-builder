import React from 'react'
import { User2 as User2Icon, Mail, Lock, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import api from '../configs/api'
import { login } from '../app/features/authSlice'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const Login = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const urlState = searchParams.get('state')
    const [state, setState] = React.useState(urlState || "login")
    const [isLoading, setIsLoading] = React.useState(false)

    const [formData, setFormData] = React.useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    })
    const [resetToken, setResetToken] = React.useState(searchParams.get('token') || '')

    React.useEffect(() => {
        setState(urlState || 'login')
        setResetToken(searchParams.get('token') || '')
    }, [urlState, searchParams])

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (isLoading) return; // Prevent duplicate submissions
        
        try {
            setIsLoading(true)
            let endpoint;
            let payload;

            if (state === 'login') {
                endpoint = '/api/users/login'
                payload = formData
            } else if (state === 'register') {
                if (formData.password !== formData.confirmPassword) {
                    toast.error('Passwords do not match.')
                    return
                }
                endpoint = '/api/users/register'
                payload = formData
            } else if (state === 'forgot') {
                endpoint = '/api/users/forgot-password'
                payload = { email: formData.email }
            } else if (state === 'reset') {
                if (!resetToken) {
                    toast.error('Missing reset token. Please open the reset link from your email.')
                    return
                }
                if (formData.password !== formData.confirmPassword) {
                    toast.error('Passwords do not match.')
                    return
                }
                endpoint = '/api/users/reset-password'
                payload = { token: resetToken, password: formData.password }
            }

            const { data } = await api.post(endpoint, payload)

            if (state === 'login' || state === 'register') {
                dispatch(login(data))
                localStorage.setItem('token', data.token)
                toast.success(data.message)
                navigate('/app')
            } else {
                toast.success(data.message)
                if (state === 'forgot') {
                    setState('login')
                    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
                }
                if (state === 'reset') {
                    navigate('/login?state=login')
                }
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }
    
    const titleText = state === 'login' ? 'Login' : state === 'register' ? 'Sign up' : state === 'forgot' ? 'Forgot Password' : 'Reset Password'
    const descriptionText = state === 'login' ? 'Please login to continue' : state === 'register' ? 'Please sign up to continue' : state === 'forgot' ? 'Enter your email to receive password reset instructions' : 'Enter a new password to reset your account'

    return (
        <div className='flex items-center justify-center min-h-screen bg-gray-50'>
            <form onSubmit={handleSubmit} className="sm:w-[350px] w-full text-center border border-gray-300/60 rounded-2xl px-8 bg-white">
                <h1 className="text-gray-900 text-3xl mt-10 font-medium">{titleText}</h1>
                <p className="text-gray-500 text-sm mt-2">{descriptionText}</p>

                {state === 'register' && (
                    <div className="flex items-center mt-6 w-full bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                        <User2Icon size={16} color='#6B7280' />
                        <input 
                            type="text" 
                            name="name" 
                            placeholder="Name" 
                            className="border-none outline-none ring-0" 
                            value={formData.name} 
                            onChange={handleChange} 
                            required 
                            disabled={isLoading}
                        />
                    </div>
                )}

                {(state === 'login' || state === 'register' || state === 'forgot') && (
                    <div className="flex items-center w-full mt-4 bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                        <Mail size={13} color="#6B7280" />
                        <input 
                            type="email" 
                            name="email" 
                            placeholder="Email id" 
                            className="border-none outline-none ring-0" 
                            value={formData.email} 
                            onChange={handleChange} 
                            required 
                            disabled={isLoading}
                        />
                    </div>
                )}

                {(state !== 'forgot') && (
                    <>
                        <div className="flex items-center mt-4 w-full bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                            <Lock size={13} color="#6B7280" />
                            <input 
                                type="password" 
                                name="password" 
                                placeholder="Password" 
                                className="border-none outline-none ring-0" 
                                value={formData.password} 
                                onChange={handleChange} 
                                required 
                                disabled={isLoading}
                            />
                        </div>
                        {(state === 'register' || state === 'reset') && (
                            <div className="flex items-center mt-4 w-full bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                                <Lock size={13} color="#6B7280" />
                                <input 
                                    type="password" 
                                    name="confirmPassword" 
                                    placeholder="Confirm Password" 
                                    className="border-none outline-none ring-0" 
                                    value={formData.confirmPassword} 
                                    onChange={handleChange} 
                                    required 
                                    disabled={isLoading}
                                />
                            </div>
                        )}
                    </>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="mt-6 w-full h-11 rounded-full text-white bg-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading && <Loader2 className="size-4 animate-spin" />}
                    {isLoading ? `${titleText}...` : titleText}
                </button>

                {state === 'login' && (
                    <p onClick={() => !isLoading && setState('forgot')} className="text-gray-500 text-sm mt-3 cursor-pointer">
                        Forgot password? <span className="text-blue-500 hover:underline">click here</span>
                    </p>
                )}

                <p className="text-gray-500 text-sm mt-3 mb-11 cursor-pointer" onClick={() => {
                    if (isLoading) return
                    if (state === 'login') setState('register')
                    else setState('login')
                }}>
                    {state === 'login' ? "Don't have an account?" : state === 'register' ? "Already have an account?" : "Back to login"} <span className="text-blue-500 hover:underline">click here</span>
                </p>
            </form>
        </div>
    )
}

export default Login