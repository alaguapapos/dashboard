// The allowlist remains the authority; a username never grants access by itself.
export function adminEmailForUsername(username:string,allowedEmails:string):string|null{
 const value=username.trim().toLowerCase();
 if(!/^[a-z0-9._+-]{1,80}$/.test(value))return null;
 const matches=[...new Set(allowedEmails.toLowerCase().split(',').map(s=>s.trim()).filter(Boolean))].filter(email=>email.split('@')[0]===value);
 return matches.length===1?matches[0]:null;
}
