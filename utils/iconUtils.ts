import { 
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  GlobeAltIcon,
  CalendarIcon,
  ViewColumnsIcon,
  DocumentTextIcon,
  LinkIcon,
  IdentificationIcon,
  ClockIcon,
  AcademicCapIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import { IconName } from '@/hooks/useColumnManagement'

// Helper function to map icon names to icon components
export const getIconComponent = (iconName: IconName) => {
  switch (iconName) {
    case 'user': return UserIcon;
    case 'envelope': return EnvelopeIcon;
    case 'phone': return PhoneIcon;
    case 'briefcase': return BriefcaseIcon;
    case 'building': return BuildingOfficeIcon;
    case 'map-pin': return MapPinIcon;
    case 'globe': return GlobeAltIcon;
    case 'calendar': return CalendarIcon;
    case 'columns': return ViewColumnsIcon;
    case 'document-text': return DocumentTextIcon;
    case 'link': return LinkIcon;
    case 'identification': return IdentificationIcon;
    case 'clock': return ClockIcon;
    case 'academic-cap': return AcademicCapIcon;
    case 'currency-dollar': return CurrencyDollarIcon;
    default: return ViewColumnsIcon;
  }
}; 