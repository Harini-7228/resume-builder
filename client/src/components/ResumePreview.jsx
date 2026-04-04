import React from 'react'
import ModernTemplate from './templates/ModernTemplate'
import ClassicTemplate from './templates/ClassicTemplate'
import MinimalTemplate from './templates/MinimalTemplate'
import MinimalImageTemplate from './templates/MinimalImageTemplate'

const ResumePreview = ({ data, template, accentColor, classes = "" }) => {

    const renderTemplate = () => {
        switch (template) {
            case "modern":
                return <ModernTemplate data={data} accentColor={accentColor} />;
            case "classic":
                return <ClassicTemplate data={data} accentColor={accentColor} />;

            case "minimal":
                return <MinimalTemplate data={data} accentColor={accentColor} />;

            case "minimal-image":
                return <MinimalImageTemplate data={data} accentColor={accentColor} />;


            default:
                return <ClassicTemplate data={data} accentColor={accentColor} />;

        }
    }
    return (
        <div id="resume-print-wrapper" className='w-full bg-gray-100'>
            <div id="resume-preview" className={"border border-gray-200 print:shadow-none print:border-none" + classes}>
                {renderTemplate()}
            </div>

            <style>{`
                @page {
                    size: letter;
                    margin: 0;
                }
                @media print {
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 8.5in;
                        height: 11in;
                        overflow: hidden;
                        background: white;
                    }
                    /* Hide everything on the page */
                    body > * {
                        display: none !important;
                    }
                    /* Show only the resume preview */
                    #resume-print-wrapper,
                    #resume-print-wrapper > *,
                    #resume-preview,
                    #resume-preview * {
                        display: revert !important;
                        visibility: visible !important;
                    }
                    #resume-print-wrapper {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 8.5in;
                        height: 11in;
                        overflow: hidden;
                        background: white;
                    }
                    #resume-preview {
                        margin: 0;
                        padding: 0;
                        box-shadow: none !important;
                        border: none !important;
                        transform-origin: top left;
                    }
                }
        `}</style>
        </div>
    )
}

export default ResumePreview