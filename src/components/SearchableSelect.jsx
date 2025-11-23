import { useState, useMemo, useEffect } from 'react'
import { Check as CheckIcon, ChevronsUpDown as ChevronsUpDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const ITEMS_PER_PAGE = 50
const LARGE_LIST_THRESHOLD = 100

// Helper to render capability tag
const CapabilityTag = ({ label }) => {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-gray-400 bg-white text-gray-900">
      {label}
    </span>
  )
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  showDescription = false,
  loading = false,
  error = null,
  className
}) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)

  const selectedOption = options.find((option) => option.id === value)

  // Reset display count when options change or popup opens/closes
  useEffect(() => {
    if (!open) {
      setDisplayCount(ITEMS_PER_PAGE)
      setSearchQuery('')
    }
  }, [open])

  // Filter and paginate options
  const { filteredOptions, hasMore, totalCount } = useMemo(() => {
    // Filter based on search query
    const filtered = searchQuery
      ? options.filter(
          (option) =>
            option.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            option.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (option.description && option.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : options

    const displayItems = filtered.slice(0, displayCount)

    return {
      filteredOptions: displayItems,
      hasMore: displayCount < filtered.length,
      totalCount: filtered.length
    }
  }, [options, searchQuery, displayCount])

  const handleLoadMore = () => {
    setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, totalCount))
  }

  const isLargeList = options.length >= LARGE_LIST_THRESHOLD

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between', className)}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.name : placeholder}
          </span>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-[100]" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
            autoFocus
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading models...
              </div>
            ) : error ? (
              <div className="p-4 space-y-2">
                <div className="text-sm text-destructive font-medium">
                  Failed to load models
                </div>
                <div className="text-xs text-muted-foreground">
                  {error}
                </div>
              </div>
            ) : (
              <>
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </div>
                ) : (
                  <>
                    <CommandGroup className="overflow-visible">
                      {/* Show count for large lists */}
                      {isLargeList && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Showing {filteredOptions.length} of {totalCount} models
                        </div>
                      )}

                      {filteredOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.id}
                          onSelect={(currentValue) => {
                            onValueChange(currentValue === value ? '' : currentValue)
                            setOpen(false)
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              'mr-2 h-4 w-4',
                              value === option.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{option.name}</div>
                            {showDescription && option.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {option.description}
                              </div>
                            )}
                            {/* Display capabilities as tags */}
                            {showDescription && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {option.contextWindow && (
                                  <CapabilityTag label={`${option.contextWindow} context`} />
                                )}
                                {option.outputModalities?.includes('text') && (
                                  <CapabilityTag label="Text" />
                                )}
                                {option.outputModalities?.includes('image') && (
                                  <CapabilityTag label="Image Gen" />
                                )}
                                {option.inputModalities?.includes('image') && (
                                  <CapabilityTag label="Vision" />
                                )}
                                {option.inputModalities?.includes('file') && (
                                  <CapabilityTag label="Files" />
                                )}
                                {option.inputModalities?.includes('audio') && (
                                  <CapabilityTag label="Audio" />
                                )}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>

                    {/* Load More Button */}
                    {hasMore && (
                      <div className="border-t p-2">
                        <Button
                          variant="ghost"
                          className="w-full text-xs"
                          onClick={(e) => {
                            e.preventDefault()
                            handleLoadMore()
                          }}
                        >
                          Load More ({totalCount - filteredOptions.length} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
