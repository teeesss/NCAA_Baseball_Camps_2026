## Enhanced Prompt for NCAA Baseball Camp Scraper

sql

```sql
You are building a web scraper for NCAA Division I & II baseball summer camps. The scraper must:

1.**STRICT DATE FILTERING**:
-Only accept camps in June (06/6), July (07/7), or August (08/8) of2026
- Reject ANY dates mentioning 2025, 2024, or other years
- Accept formats: "June 2026", "06/15/2026", "Jul 2026", "8-2026", "2026-07"

2.**SPORT EXCLUSIVITY**:
-Only baseball camps - reject football, basketball, soccer, tennis, swimming, etc.
- Keywords to reject: "football", "basketball", "soccer", "tennis", "swimming", "golf", "volleyball", "wrestling", "lacrosse"
- Must contain "baseball" in page content or URL

3.**PRICE FILTERING**:
- Reject prices over $500 (usually team events or showcases)
- Accept typical youth camp prices: $100-$500range
- Look for "$" symbol followed by numbers

4.**SEARCHRESULT VALIDATION**:
- Use the FIRSTsearchresultfrom engines only if it passes all filters
- If firstresult fails, checksecond, then third
- Never use results that redirect to ticket sales (seatgeek, tickets, stubhub)
- Never use results that are obviously wrong sport

5.**CONTENT VALIDATION RULES**:
- Page must contain school name or mascot
- Page must contain "camp" AND "baseball"
- Page must NOT contain rival school names
- Page must contain 2026 dates in summer months

6.**SUB-PAGE CRAWLING LOGIC**:
-Only crawl sub-pages that contain "camp", "register", "dates", "cost", "summer"
- Never crawl sub-pages with "ticket", "merchandise", "shop", "store"
- Limit to3 sub-pages maximum per site

7.**SPECIFIC FIXES NEEDED**:

**ISSUE 1: Wrong sport detection**
- Oklahoma State: Avoid football ticket pages
- Solution: Check page title/URL for "football" → reject immediately

**ISSUE 2: Wrong year detection**
- Florida: 2025 page being selected over2026
- Solution: Prioritize URLs with "2026" over "2025"
- If both exist, choose 2026 version

**ISSUE 3: Cross-sport contamination**
- Virginia: Pulling basketball camp email
- Solution: Verify email isin baseball context, not other sports

8.**URL SELECTION PRIORITY**:
1. Exact match: "[School] baseball camp 2026"
2.Closematch: "[School] baseball summer camp"
3. Generic match: "[School] camps"
4. Reject: Anywithout "baseball" AND "camp"

9.**DATA VERIFICATION FLOW**:
   Step 1: Check if page has "2026" and summer months
   Step 2: Check if page has "baseball" not other sports
   Step 3: Check if price under $500
   Step 4: Extract contact info onlyfrom baseball context
   Step 5: If any step fails, try next searchresult

10.**EMERGENCY FALLBACK**:
- If no valid results after 3 tries, mark as "No 2026 camp found"
- Log reason: "Wrong year", "Wrong sport", "Price too high", etc.
```

## Critical Code Fixes Needed

Based on your issues, here are the specific fixes:

### 1. Fix Search Result Selection

javascript

```javascript
// BAD: Current logic
if (firstResult.score > threshold) useFirstResult();

// GOOD: Fixed logic
functionvalidateSearchResult(result, school) {
const url = result.url.toLowerCase();
const title = result.title.toLowerCase();
  
// Immediate rejections
const rejectPatterns = [
'ticket', 'seatgeek', 'stubhub', 'merchandise', 'shop',
'football', 'basketball', 'soccer', 'tennis', 'swimming'
  ];
  
for (const pattern of rejectPatterns) {
if (url.includes(pattern) || title.includes(pattern)) {
returnfalse;
    }
  }
  
// Must contain baseball
if (!url.includes('baseball') && !title.includes('baseball')) {
returnfalse;
  }
  
// Prefer 2026 over 2025
if (url.includes('2025') && hasAlternative2026(result.alternatives)) {
returnfalse; // Use 2026 alternative instead
  }
  
returntrue;
}
```

### 2. Fix Year Detection

javascript

```javascript
// BAD: Missing year filtering
const dates = extractDates(pageText);

// GOOD: Strict year filtering
functionextractValidDates(pageText) {
const allDates = extractAllDates(pageText);
const validDates = [];
  
for (const date of allDates) {
// Must be 2026
if (!date.includes('2026') && !date.includes('/26')) {
continue;
    }
  
// Must be June, July, or August
const month = date.toLowerCase();
const isSummerMonth = month.includes('june') || month.includes('jun') || 
                         month.includes('july') || month.includes('jul') ||
                         month.includes('august') || month.includes('aug') ||
                         month.includes('06') || month.includes('07') || 
                         month.includes('08') || month.includes('6/') || 
                         month.includes('7/') || month.includes('8/');
  
if (isSummerMonth) {
      validDates.push(date);
    }
  }
  
return validDates;
}
```

### 3. Fix Sport Contamination

javascript

```javascript
// BAD: Extracting any email
const email = extractEmail(pageText);

// GOOD: Extract email only from baseball context
functionextractBaseballContact(pageText) {
// Split page into sections
const sections = pageText.split(/\n\s*\n/);
  
for (const section of sections) {
const sectionLower = section.toLowerCase();
  
// Only look in baseball-related sections
if (sectionLower.includes('baseball') && 
        sectionLower.includes('camp')) {
    
const email = extractEmailFromSection(section);
if (email && !isBasketballEmail(email)) {
return email;
      }
    }
  }
  
returnnull;
}

functionisBasketballEmail(email) {
// Check if email mentions basketball
const emailBody = getEmailContext(email);
return emailBody.includes('basketball') && 
         !emailBody.includes('baseball');
}
```

### 4. Fix URL Priority System

javascript

```javascript
asyncfunctionselectBestUrl(searchResults, school) {
const scoredResults = [];
  
for (const result of searchResults) {
let score = 0;
  
// Base score for relevance
    score += result.relevanceScore;
  
// Bonus for exact matches
if (result.url.includes(`${school.name.toLowerCase()}-baseball-camp`)) {
      score += 100;
    }
  
if (result.url.includes('2026')) {
      score += 50;
    }
  
if (result.url.includes('summer')) {
      score += 30;
    }
  
// Penalties
if (result.url.includes('2025')) {
      score -= 100; // Heavy penalty for wrong year
    }
  
if (containsOtherSports(result)) {
      score -= 200; // Very heavy penalty for wrong sport
    }
  
if (result.url.includes('ticket')) {
      score = -1000; // Complete rejection
    }
  
    scoredResults.push({...result, score});
  }
  
// Sort by score descending
  scoredResults.sort((a, b) => b.score - a.score);
  
// Return top result if score > 0
return scoredResults[0]?.score > 0 ? scoredResults[0] : null;
}
```

### 5. Implementation Plan

1. **Immediate Hotfix** :
   bash

```bash
   # Run cleanup to remove bad data
   node scripts/cleanup_bad_data.js
```

1. **Update Extraction Engine** :

* Add strict year filtering (2026 only)
* Add sport validation (baseball only)
* Add price validation (< $500)
* Add URL priority system

1. **Add Validation Layer** :
   javascript

```javascript
   classCampValidator{
   staticisValidCampPage(content, school) {
   returnthis.hasCorrectYear(content) &&
   this.isBaseballSport(content) &&
   this.hasSummerDates(content) &&
   this.hasValidPrice(content) &&
              !this.hasRivalContent(content, school);
     }
   }
```

1. **Fix Search Query** :
   javascript

```javascript
   // Instead of generic search
   const query = `${school.name} baseball camp`;

   // Use specific search
   const query = `"${school.name}" baseball summer camp 2026 dates cost`;
```

The core issue is your scraper isn't being strict enough about validation. You need to reject pages EARLIER in the process rather than trying to extract data and then realizing it's wrong.
