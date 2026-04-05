import { ArrowLeft, LoaderCircle } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ResumePreview from '../components/ResumePreview'
import api from '../configs/api'

const Preview = () => {
  const { resumeId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadResume = async () => {
      try {
        setIsLoading(true)
        setError(null)
        // ✅ FIX: fetch from real API public endpoint instead of dummyResumeData
        const { data } = await api.get(`/api/resumes/public/${resumeId}`)
        setResumeData(data.resume)
        if (data.resume?.title) {
          document.title = `${data.resume.title} - Resume Builder`
        }
      } catch (err) {
        console.error("Failed to load public resume:", err)
        setError(err?.response?.data?.message || "Resume not found or is not public")
      } finally {
        setIsLoading(false)
      }
    }
    loadResume()
    return () => {
      document.title = "Resume Builder"
    }
  }, [resumeId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoaderCircle className="animate-spin size-12 text-blue-600" />
      </div>
    )
  }

  if (error || !resumeData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6">
        <p className="text-center text-5xl text-slate-400 font-medium">
          {error || "Resume not found"}
        </p>
        <Link
          to="/"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6 h-9 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="size-4" /> Go to home page
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="max-w-3xl mx-auto py-10">
        <ResumePreview
          data={resumeData}
          template={resumeData.template}
          accentColor={resumeData.accent_color}
          classes="py-4 bg-white"
        />
      </div>
    </div>
  )
}

export default Preview
