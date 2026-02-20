import { memo } from 'react'

export const ResolvedImage = memo(({ image, index, onImageClick }) => {
  const name = `generated-${index + 1}.png`
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <img
        src={image.src}
        alt={`Generated Image ${index + 1}`}
        className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onImageClick({ url: image.src, name })}
        onError={(e) => { e.target.style.display = 'none' }}
      />
    </div>
  )
})
