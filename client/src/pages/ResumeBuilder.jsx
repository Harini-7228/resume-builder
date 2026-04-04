import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PersonalInfoForm from '../components/PersonalInfoForm'
import ResumePreview from '../components/ResumePreview'
import { ArrowLeftIcon, GraduationCap, User, FileText, Briefcase, FolderIcon, Sparkles, ChevronRightIcon, ChevronLeftIcon, Share2Icon, EyeIcon, EyeOffIcon, DownloadIcon, LoaderCircle } from 'lucide-react'
import TemplateSelector from '../components/home/TemplateSelector'
import ColorPicker from '../components/ColorPicker'
import ProfessionalSummaryForm from '../components/ProfessionalSummaryForm'
import ExperienceForm from '../components/ExperienceForm'
import EducationForm from '../components/EducationForm'
import ProjectForm from '../components/ProjectForm'
import SkillsForm from '../components/SkillsForm'
import api from '../configs/api'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'

const ResumeBuilder = () => {

  const { resumeId } = useParams()
  const {token} = useSelector(state => state.auth)
  const [isLoading, setIsLoading] = useState(true)

  const [resumeData, setResumeData] = useState({
    _id: '',
    title: '',
    personal_info: {},
    professional_summary: "",
    experience: [],
    education: [],
    project: [],
    skills: [],
    template: "classic",
    accent_color: "#3B82F6",
    public: false,
  })

  const loadExistingResume = async () => {
   try {
    setIsLoading(true)
    const {data} = await api.get('/api/resumes/get/' +resumeId, {headers: {Authorization: `Bearer ${token}`}})
    if(data.resume){
      setResumeData(data.resume)
      document.title = data.resume.title
    }
   } catch (error) {
     console.log(error.message)
     toast.error(error?.response?.data?.message || "Failed to load resume")
   } finally {
     setIsLoading(false)
   }
  }

  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [removeBackground, setRemoveBackground] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sections = [
    { id: "personal", name: "Personal Info", icon: User },
    { id: "summary", name: "Summary", icon: FileText },
    { id: "experience", name: "Experience", icon: Briefcase },
    { id: "education", name: "Education", icon: GraduationCap },
    { id: "project", name: "Projects", icon: FolderIcon },
    { id: "skills", name: "Skills", icon: Sparkles },
  ]

  const activeSection = sections[activeSectionIndex]

  useEffect(() => {
    loadExistingResume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId])

  const changeResumeVisibility = async () => {
    try {
      const updatedVisibility = !resumeData.public;
      setResumeData({ ...resumeData, public: updatedVisibility });
      
      // Save to backend
      await api.put('/api/resumes/update/', { 
        resumeId, 
        resumeData: { ...resumeData, public: updatedVisibility } 
      }, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      toast.success(updatedVisibility ? "Resume is now public" : "Resume is now private");
    } catch (error) {
      console.error(error);
      // Revert on error
      setResumeData({ ...resumeData, public: resumeData.public });
      toast.error(error?.response?.data?.message || "Failed to update visibility");
    }
  }

  const handleShare = () => {
    const frontendUrl = window.location.href.split('/app')[0];
    const resumeUrl = frontendUrl + '/view/' + resumeId;

    if (navigator.share) {
      navigator.share({ url: resumeUrl, text: "My Resume", })
        .catch((error) => console.log('Error sharing:', error));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(resumeUrl)
        .then(() => toast.success("Link copied to clipboard!"))
        .catch(() => toast.error("Failed to copy link"));
    }
  }

  const downloadResume = () => {
    window.print();
  }

  const saveChanges = async () => {
    if (isSaving) return; // Prevent duplicate requests
    
    try {
      setIsSaving(true);
      const { data } = await api.put('/api/resumes/update/', { 
        resumeId, 
        resumeData 
      }, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success(data.message || "Resume saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Failed to save resume");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <LoaderCircle className='animate-spin size-12 text-blue-600' />
      </div>
    )
  }

  return (
    <div>
      <div className='max-w-7xl mx-auto px-4 py-6'>
        <Link to={'/app'} className="inline-flex gap-2 items-center text-slate-500  hover:text-slate-700 transition-all">
          <ArrowLeftIcon className="size-4" /> Back to Dashboard
        </Link>
      </div>

      <div className='max-w-7xl mx-auto px-4 pb-8'>
        <div className='grid lg:grid-cols-12 gap-8'>

          <div className='relative lg:col-span-5 rounded-lg overflow-hidden'>
            <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 pt-1'>

              <hr className="absolute top-0 left-0 right-0 border-2 border-gray-200" />
              <hr className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 border-none transition-all duration-2000"
                style={{ width: `${activeSectionIndex * 100 / (sections.length - 1)}%` }} />

              <div className="flex justify-between items-center mb-6 border-b border-gray-300 py-1">
                <div className="flex items-center gap-2">
                  <TemplateSelector selectedTemplate={resumeData.template} onChange={(template) => setResumeData(prev => ({ ...prev, template }))} />
                  <ColorPicker selectedColor={resumeData.accent_color} onChange={(color) => setResumeData(prev => ({ ...prev, accent_color: color }))} />
                </div>
                <div className='flex items-center'>
                  {activeSectionIndex !== 0 && (
                    <button onClick={() => setActiveSectionIndex((prevIndex) => Math.max(prevIndex - 1, 0))} className='flex items-center gap-1 p-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all' disabled={activeSectionIndex === 0}>
                      <ChevronLeftIcon className="size-4" /> Previous
                    </button>
                  )}
                  <button onClick={() => setActiveSectionIndex((prevIndex) => Math.min(prevIndex + 1, sections.length - 1))} className={`flex items-center gap-1 p-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all ${activeSectionIndex === sections.length - 1 && 'opacity-50'}`} disabled={activeSectionIndex === sections.length - 1}>
                    Next <ChevronRightIcon className="size-4" />
                  </button>
                </div>

              </div>

              <div className='space-y-6'>
                {activeSection.id === 'personal' && (
                  <PersonalInfoForm data={resumeData.personal_info} onChange={(data) => setResumeData(prev => ({ ...prev, personal_info: data }))} removeBackground={removeBackground} setRemoveBackground={setRemoveBackground} />
                )}
                {activeSection.id === 'summary' && (
                  <ProfessionalSummaryForm data={resumeData.professional_summary} onChange={(data) => setResumeData(prev => ({ ...prev, professional_summary: data }))} />
                )}
                {activeSection.id === 'experience' && (
                  <ExperienceForm data={resumeData.experience} onChange={(data) => setResumeData(prev => ({ ...prev, experience: data }))} />
                )}
                {activeSection.id === 'education' && (
                  <EducationForm data={resumeData.education} onChange={(data) => setResumeData(prev => ({ ...prev, education: data }))} />
                )}
                {activeSection.id === 'project' && (
                  <ProjectForm data={resumeData.project} onChange={(data) => setResumeData(prev => ({ ...prev, project: data }))} />
                )}
                {activeSection.id === 'skills' && (
                  <SkillsForm data={resumeData.skills} onChange={(data) => setResumeData(prev => ({ ...prev, skills: data }))} />
                )}
              </div>
              <button 
                onClick={saveChanges} 
                disabled={isSaving}
                className='bg-gradient-to-br from-blue-100 to-blue-200 ring-blue-200 text-blue-600 ring hover:ring-blue-400 transition-all rounded-md px-6 py-2 mt-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
              >
                {isSaving && <LoaderCircle className="size-4 animate-spin" />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 max-lg:mt-6">
            <div className='relative w-full'>
              <div className='absolute bottom-3 left-0 right-0 flex items-center justify-end gap-2'>
                {resumeData.public && (
                  <button onClick={handleShare} className='flex items-center p-2 px-4 gap-2 text-xs bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 rounded-lg ring-blue-300 hover:ring transition-colors'>
                    <Share2Icon className="size-4" /> Share
                  </button>
                )}
                <button onClick={changeResumeVisibility} className='flex items-center p-2 px-4 gap-2 text-xs bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 ring-purple-300 rounded-lg hover:ring transition-colors'>
                  {resumeData.public ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
                  {resumeData.public ? 'Public' : 'Private'}
                </button>
                <button onClick={downloadResume} className='flex items-center p-2 px-4 gap-2 text-xs bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 ring-blue-300 rounded-lg hover:ring transition-colors'>
                  <DownloadIcon className="size-4" />
                  Download
                </button>
              </div>
            </div>

            <ResumePreview data={resumeData} template={resumeData.template} accentColor={resumeData.accent_color} />
          </div>
        </div>

      </div>

    </div>
  )
}

export default ResumeBuilder
