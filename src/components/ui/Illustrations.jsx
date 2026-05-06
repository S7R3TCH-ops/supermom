import { useAppTheme } from '../../context/AppThemeContext';

export const EmptySchedule = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <path d="M40 30H80C82.2091 30 84 31.7909 84 34V86C84 88.2091 82.2091 90 80 90H40C37.7909 90 36 88.2091 36 86V34C36 31.7909 37.7909 30 40 30Z" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 46H84" stroke={c} strokeWidth="2.5" />
      <path d="M50 24V36" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 24V36" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="68" r="10" stroke={c} strokeWidth="2.5" strokeDasharray="4 4" />
    </svg>
  );
};

export const EmptyClients = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <path d="M60 65C68.2843 65 75 58.2843 75 50C75 41.7157 68.2843 35 60 35C51.7157 35 45 41.7157 45 50C45 58.2843 51.7157 65 60 65Z" stroke={c} strokeWidth="2.5" />
      <path d="M35 90C35 78.9543 43.9543 70 55 70H65C76.0457 70 85 78.9543 85 90" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M90 40L100 50M90 50L100 40" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const AllDone = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <path d="M40 60L55 75L85 45" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 35C28 25 40 20 60 20C80 20 92 25 95 35" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <path d="M25 85C28 95 40 100 60 100C80 100 92 95 95 85" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
};

export const NoResults = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <circle cx="55" cy="55" r="25" stroke={c} strokeWidth="2.5" />
      <path d="M73 73L85 85" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M48 55H62" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
};

export const NoServices = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <rect x="35" y="35" width="50" height="50" rx="6" stroke={c} strokeWidth="2.5" />
      <path d="M45 50H75" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M45 60H75" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M45 70H60" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
};

export const EmptyFinance = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <path d="M40 40H80V80H40V40Z" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 55H80" stroke={c} strokeWidth="2.5" />
      <path d="M55 40V80" stroke={c} strokeWidth="2.5" />
      <circle cx="60" cy="60" r="15" stroke={c} strokeWidth="2" fill={T.bg} />
      <path d="M60 52V68M55 56H65M55 64H65" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const EmptyActivity = ({ size = 120, color }) => {
  const { T } = useAppTheme();
  const c = color || T.pink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill={c} fillOpacity="0.05" />
      <path d="M35 75L50 55L65 65L85 35" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="75" r="3" fill={c} />
      <circle cx="50" cy="55" r="3" fill={c} />
      <circle cx="65" cy="65" r="3" fill={c} />
      <circle cx="85" cy="35" r="3" fill={c} />
      <path d="M30 85H90" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
};
