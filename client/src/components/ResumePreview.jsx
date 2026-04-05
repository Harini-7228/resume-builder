import React from 'react'
import ModernTemplate from './templates/ModernTemplate'
import ClassicTemplate from './templates/ClassicTemplate'
import MinimalTemplate from './templates/MinimalTemplate'
import MinimalImageTemplate from './templates/MinimalImageTemplate'

const ResumePreview = ({ data, template, accentColor, removeBackground, classes = "" }) => {

    const renderTemplate = () => {
        switch (template) {
            case "modern":
                return <ModernTemplate data={data} accentColor={accentColor} removeBackground={removeBackground} />;
            case "classic":
                return <ClassicTemplate data={data} accentColor={accentColor} removeBackground={removeBackground} />;

            case "minimal":
                return <MinimalTemplate data={data} accentColor={accentColor} removeBackground={removeBackground} />;

            case "minimal-image":
                return <MinimalImageTemplate data={data} accentColor={accentColor} removeBackground={removeBackground} />;

            default:
                return <ClassicTemplate data={data} accentColor={accentColor} removeBackground={removeBackground} />;

        }
    }
    return (
        <div id="resume-print-wrapper" className='w-full bg-gray-100'>
            <div id="resume-preview" className={"border border-gray-200 print:shadow-none print:border-none" + classes}>
                {renderTemplate()}
            </div>

            <style>{`
                @page {
                    size: a4 portrait;
                    margin: 0;
                }
                @media print {
                    html, body {
                        width: 100%;
                        height: auto;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #resume-preview,
                    #resume-preview * {
                        visibility: visible !important;
                    }
                    #resume-preview {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: auto !important;
                        min-height: 100vh;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: white !important;
                    }
                    #resume-preview > div {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                    }
                    #resume-preview section {
                        margin-bottom: calc(1.5rem + var(--fill-gap, 0px)) !important;
                    }
                    #resume-preview * {
                        box-sizing: border-box !important;
                    }
                }
        `}</style>
        </div>
    )
}

export default ResumePreview