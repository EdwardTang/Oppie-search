// Function to extract content between tags
export function extractTagContent(text, tagName) {
    const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 'gs');
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        matches.push(match[1].trim());
    }
    return matches;
}

// Function to perform web search
export async function performWebSearch(query, maxResults = 3) {
    try {
        console.log('Starting search for:', query);
        
        // Use DuckDuckGo's HTML interface through a CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://duckduckgo.com/html?q=${encodeURIComponent(query)}`)}`;
        console.log('Fetching from proxy URL:', proxyUrl);
        
        const response = await fetch(proxyUrl);
        const html = await response.text();
        
        // Parse the HTML response to extract search results
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        const articles = doc.querySelectorAll('.result');
        
        for (let i = 0; i < articles.length && results.length < maxResults; i++) {
            const article = articles[i];
            const link = article.querySelector('a.result__a');
            const snippet = article.querySelector('.result__snippet');
            
            if (link && snippet) {
                results.push({
                    title: link.textContent.trim(),
                    url: link.getAttribute('href'),
                    snippet: snippet.textContent.trim()
                });
            }
        }
        
        console.log('Parsed results:', results);
        return results;
    } catch (error) {
        console.error('Search error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return [];
    }
}

// Function to visit webpage and get content
export async function visitWebpage(url) {
    try {
        console.log('Visiting URL:', url);
        
        // For weather-specific URLs, return formatted weather data
        if (url.includes('accuweather.com')) {
            return 'Current weather data available at AccuWeather. Please visit the link for real-time information.';
        }
        
        // Using allorigins with raw response for better CORS support
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const html = await response.text();
        
        // Basic HTML to text conversion
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove scripts and styles
        const scripts = tempDiv.getElementsByTagName('script');
        const styles = tempDiv.getElementsByTagName('style');
        for (let i = scripts.length - 1; i >= 0; i--) scripts[i].remove();
        for (let i = styles.length - 1; i >= 0; i--) styles[i].remove();
        
        // Get text content and clean it up
        let text = tempDiv.textContent || tempDiv.innerText;
        text = text.replace(/\s+/g, ' ').trim();
        
        console.log('Got webpage content length:', text.length);
        return text.slice(0, 2000); // Limit to first 2000 chars
    } catch (error) {
        console.error('Webpage visit error:', error);
        return '';
    }
}

// Function to process response and get search/visit results
export async function processResponseForContext(response) {
    console.log('Processing response for context:', response);
    const searchQueries = extractTagContent(response, 'search');
    console.log('Extracted search queries:', searchQueries);
    
    let context = '';
    
    // Only process the first search query
    if (searchQueries.length > 0) {
        const query = searchQueries[0];
        console.log('Performing search for:', query);
        const results = await performWebSearch(query);
        console.log('Search results:', results);
        
        if (results.length > 0) {
            // Format results in a clean, readable way
            context = results.slice(0, 5).map((result, i) => 
                `${i + 1}. ${result.title}\n${result.snippet}\n${result.url}`
            ).join('\n\n');
        }
    }
    
    console.log('Final context:', context);
    return context;
} 