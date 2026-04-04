import { UploadCloudIcon, Plus as PlusIcon, FilePen, Trash2, Pencil, X as XIcon, UploadCloud, LoaderCircleIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../configs/api'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { token, user } = useSelector(state => state.auth) 
  const colors = ["#9333ea", "#d97706", "#dc2626", "#0284c7", "#16a34a"]
  const [allResumes, setAllResumes] = useState([])
  const [showCreateResume, setShowCreateResume] = useState(false)
  const [showUploadResume, setShowUploadResume] = useState(false)
  const [title, setTitle] = useState('')
  const [resume, setResume] = useState(null)
  const [editResumeId, setEditResumeId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const navigate = useNavigate()

  const loadAllResumes = async () => {
    try {
      const { data } = await api.get('/api/users/resumes', { headers: { Authorization: `Bearer ${token}` } })
      setAllResumes(data.resumes)
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    }
  }

  const createResume = async (event) => {
    try {
      event.preventDefault()
      if (isCreating) return
      setIsCreating(true)
      const { data } = await api.post('/api/resumes/create', { title }, { headers: { Authorization: `Bearer ${token}` } })
      setAllResumes([data.resume, ...allResumes])
      setTitle('')
      setShowCreateResume(false)
      toast.success("Resume created successfully!")
      navigate(`/app/builder/${data.resume._id}`)
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setIsCreating(false)
    }
  }

  const uploadResume = async (event) => {
    event.preventDefault()
    if (isLoading) return
    try {
      if (!resume) return toast.error("Please select a resume file")
      if (!title) return toast.error("Please enter a resume title")

      setIsLoading(true)
      const formData = new FormData()
      formData.append('resume', resume)
      formData.append('title', title)

      toast.loading("Uploading and parsing resume... This may take up to 2 minutes.")

      const { data } = await api.post("/api/ai/upload-resume-file", formData, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000,
      })

      toast.dismiss()
      toast.success("Resume uploaded and parsed successfully!")
      setResume(null)
      setTitle("")
      setShowUploadResume(false)
      await loadAllResumes()
      navigate(`/app/builder/${data.resumeId}`)
    } catch (error) {
      toast.dismiss()
      console.error("Upload error:", error)
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error("Upload timed out. Please try again with a shorter resume.")
      } else if (error?.response?.status === 429) {
        toast.error("AI service is busy. Please wait 30 seconds and try again.")
      } else if (error?.response?.status === 400) {
        toast.error(error?.response?.data?.message || "Invalid file. Please check your PDF.")
      } else if (error?.response?.status === 401) {
        toast.error("Session expired. Please log in again.")
      } else {
        toast.error(error?.response?.data?.message || error.message || "Failed to upload resume.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const editTitle = async (event) => {
    try {
      event.preventDefault()
      if (isEditing) return
      setIsEditing(true)
      const { data } = await api.put('/api/resumes/update/', { resumeId: editResumeId, resumeData: { title } }, { headers: { Authorization: `Bearer ${token}` } })
      setAllResumes(allResumes.map(r => r._id === editResumeId ? data.resume : r))
      setTitle('')
      setEditResumeId('')
      toast.success(data.message || "Resume title updated!")
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setIsEditing(false)
    }
  }

  const deleteResume = async (resumeId) => {
    try {
      if (!window.confirm("Are you sure you want to delete this resume?")) return
      const { data } = await api.delete(`/api/resumes/delete/${resumeId}`, { headers: { Authorization: `Bearer ${token}` } })
      setAllResumes(allResumes.filter(r => r._id !== resumeId))
      toast.success(data.message)
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    }
  }

  useEffect(() => {
    loadAllResumes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className='max-w-7xl mx-auto px-4 py-8'>

        {/* ✅ FIX: show real user name from Redux store */}
        <p className='text-2xl font-medium mb-6 bg-gradient-to-r from-slate-600 to-slate-700 bg-clip-text text-transparent sm:hidden'>
          Welcome, {user?.name || 'User'}
        </p>

        <div className='flex gap-4'>
          <button onClick={() => setShowCreateResume(true)} className='w-full bg-white sm:max-w-36 h-48 flex flex-col items-center justify-center rounded-lg gap-2 text-slate-600 border border-dashed border-slate-300 group hover:border-blue-500 hover:shadow-lg transition-all duration-300 cursor-pointer'>
            <PlusIcon className='size-11 transition-all duration-300 p-2.5 bg-gradient-to-br from-blue-300 to-blue-500 text-white rounded-full' />
            <p className='text-sm group-hover:text-blue-600 transition-all duration-300'>Create Resume</p>
          </button>
          <button onClick={() => setShowUploadResume(true)} className='w-full bg-white sm:max-w-36 h-48 flex flex-col items-center justify-center rounded-lg gap-2 text-slate-600 border border-dashed border-slate-300 group hover:border-blue-500 hover:shadow-lg transition-all duration-300 cursor-pointer'>
            <UploadCloudIcon className='size-11 transition-all duration-300 p-2.5 bg-gradient-to-br from-blue-300 to-blue-500 text-white rounded-full' />
            <p className='text-sm group-hover:text-blue-600 transition-all duration-300'>Upload Existing</p>
          </button>
        </div>

        <hr className='border-slate-300 my-6 sm:w-[305px]' />

        <div className="grid grid-cols-2 sm:flex flex-wrap gap-4">
          {allResumes.map((resume, index) => {
            const baseColor = colors[index % colors.length]
            return (
              <button key={resume._id} onClick={() => navigate(`/app/builder/${resume._id}`)} className='relative w-full sm:max-w-36 h-48 flex flex-col items-center justify-center rounded-lg gap-2 border group hover:shadow-lg transition-all duration-300 cursor-pointer' style={{ background: `linear-gradient(135deg, ${baseColor}10, ${baseColor}40)`, borderColor: baseColor + '40' }}>
                <FilePen className="size-7 group-hover:scale-105 transition-all" style={{ color: baseColor }} />
                <p className='text-sm group-hover:scale-105 transition-all px-2 text-center' style={{ color: baseColor }}>{resume.title}</p>
                <p className='absolute bottom-1 text-[11px] transition-all duration-300 px-2 text-center' style={{ color: baseColor + '90' }}>
                  Updated on {new Date(resume.updatedAt).toLocaleDateString()}
                </p>
                <div onClick={(e) => e.stopPropagation()} className='absolute top-1 right-1 group-hover:flex items-center hidden'>
                  <Trash2 onClick={(e) => { e.stopPropagation(); deleteResume(resume._id) }} className="size-7 p-1.5 hover:bg-white/50 rounded text-slate-700 transition-colors" />
                  <Pencil onClick={(e) => { e.stopPropagation(); setEditResumeId(resume._id); setTitle(resume.title) }} className="size-7 p-1.5 hover:bg-white/50 rounded text-slate-700 transition-colors" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Create Resume Modal */}
        {showCreateResume && (
          <form onSubmit={createResume} onClick={() => !isCreating && setShowCreateResume(false)} className='fixed inset-0 bg-black/70 backdrop-blur bg-opacity-50 z-10 flex items-center justify-center'>
            <div onClick={e => e.stopPropagation()} className='relative bg-slate-50 border shadow-md rounded-lg w-full max-w-sm p-6'>
              <h2 className='text-xl font-bold mb-4'>Create a Resume</h2>
              <input onChange={(e) => setTitle(e.target.value)} value={title} type="text" placeholder="Enter resume title" className="w-full px-4 py-2 mb-4 border rounded focus:outline-none focus:border-blue-600" required disabled={isCreating} />
              <button type="submit" disabled={isCreating} className='w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
                {isCreating && <LoaderCircleIcon className="size-4 animate-spin" />}
                {isCreating ? 'Creating...' : 'Create Resume'}
              </button>
              {!isCreating && <XIcon className='absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer' onClick={() => { setShowCreateResume(false); setTitle('') }} />}
            </div>
          </form>
        )}

        {/* Upload Resume Modal */}
        {showUploadResume && (
          <form onSubmit={uploadResume} onClick={() => !isLoading && setShowUploadResume(false)} className='fixed inset-0 bg-black/70 backdrop-blur bg-opacity-50 z-10 flex items-center justify-center'>
            <div onClick={e => e.stopPropagation()} className='relative bg-slate-50 border shadow-md rounded-lg w-full max-w-sm p-6'>
              <h2 className='text-xl font-bold mb-4'>Upload Resume</h2>
              <input onChange={(e) => setTitle(e.target.value)} value={title} type="text" placeholder="Enter resume title" className="w-full px-4 py-2 mb-4 border rounded focus:outline-none focus:border-blue-600" required disabled={isLoading} />
              <label htmlFor="resume-input" className="block text-sm text-slate-700">
                Select resume file
                <div className='flex flex-col items-center justify-center gap-2 border text-slate-400 border-slate-400 border-dashed rounded-md p-4 py-10 my-4 hover:border-blue-500 hover:text-blue-700 cursor-pointer transition-colors'>
                  {resume ? <p className='text-blue-700'>{resume.name}</p> : <><UploadCloud className='size-14 stroke-1' /><p>Click to upload PDF</p></>}
                </div>
              </label>
              <input type="file" id='resume-input' accept='.pdf' hidden onChange={(e) => setResume(e.target.files[0])} disabled={isLoading} />
              <button type="submit" disabled={isLoading} className='w-full bg-blue-600 flex justify-center items-center gap-2 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
                {isLoading && <LoaderCircleIcon className='animate-spin size-4 text-white' />}
                {isLoading ? 'Uploading...' : 'Upload Resume'}
              </button>
              {!isLoading && <XIcon className='absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer' onClick={() => { setShowUploadResume(false); setTitle(''); setResume(null) }} />}
            </div>
          </form>
        )}

        {/* Edit Title Modal */}
        {editResumeId && (
          <form onSubmit={editTitle} onClick={() => !isEditing && setEditResumeId('')} className='fixed inset-0 bg-black/70 backdrop-blur bg-opacity-50 z-10 flex items-center justify-center'>
            <div onClick={e => e.stopPropagation()} className='relative bg-slate-50 border shadow-md rounded-lg w-full max-w-sm p-6'>
              <h2 className='text-xl font-bold mb-4'>Edit Resume Title</h2>
              <input onChange={(e) => setTitle(e.target.value)} value={title} type="text" placeholder="Enter resume title" className="w-full px-4 py-2 mb-4 border rounded focus:outline-none focus:border-blue-600" required disabled={isEditing} />
              <button type="submit" disabled={isEditing} className='w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
                {isEditing && <LoaderCircleIcon className="size-4 animate-spin" />}
                {isEditing ? 'Updating...' : 'Update'}
              </button>
              {!isEditing && <XIcon className='absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer' onClick={() => { setEditResumeId(''); setTitle('') }} />}
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

export default Dashboard
