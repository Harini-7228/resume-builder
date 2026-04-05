import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { Sparkles, Loader2 } from 'lucide-react'
import api from '../configs/api'
import toast from 'react-hot-toast'

const ProfessionalSummaryForm = ({ data, onChange }) => {
    const { token } = useSelector(state => state.auth)
    const [loading, setLoading] = useState(false);

    const handleAIEnhance = async () => {
        if (!data) {
            return toast.error("Please enter some content first")
        }
        try {
            setLoading(true)
            const { data: responseData } = await api.post('/api/ai/enhance-pro-sum', { userContent: data }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (responseData.enhancedContent) {
                onChange(responseData.enhancedContent)
                toast.success("Summary enhanced!")
            }
        } catch (error) {
            console.error(error)
            toast.error(error.response?.data?.message || "Failed to enhance summary")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='space-y-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h3 className='flex items-center gap-2 text-lg font-semibold text-gray-900'>Professional Summary</h3>
                    <p className='text-sm text-gray-500'>Add summary for your resume here</p>
                </div>
                <button
                    onClick={handleAIEnhance}
                    disabled={loading}
                    className='flex items-center gap-2 px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors disabled:opacity-50'
                >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {loading ? 'Enhancing...' : 'AI Enhance'}
                </button>
            </div>
            <div className='mt-6'>
                <textarea
                    value={data || ""}
                    onChange={(e) => onChange(e.target.value)}
                    rows={7}
                    className='w-full p-3 px-4 mt-2 border text-sm border-gray-300 rounded-lg focus:ring focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none'
                    placeholder='Write a compelling professional summary that highlights your key strengths and career objectives..'
                ></textarea>
                <p className='text-xs text-gray-500 max-w-4/5 mx-auto text-center'>Tip: Keep it concise (3-4 sentences) and focus on your most relevant achievements and skills.</p>
            </div>
        </div>
    )
}

export default ProfessionalSummaryForm
