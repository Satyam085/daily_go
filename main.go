package main

import (
	"context"
	"crypto/sha1"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

//go:embed index.html app.js styles.css
var staticFiles embed.FS

var baseURL = "http://das.dgvcl.in/DailyActivity"

// ==========================================
// MASTER DB
// ==========================================
type FeederMaster struct {
	Name  string
	Type  string
	Start string
	End   string
	MW    string
}

var masterDB = map[string]FeederMaster{}

var masterScheduleRaw = `322707	Bahej	AG	Bhimpore	07:00:00	17:00:00	0.02
322704	Bhimpore	JGY	Bhimpore	00:00:00	24:00:00	0.02
322706	Hathuka	AG	Bhimpore	07:00:00	17:00:00	0.02
322702	Hill	HTEX	Bhimpore	00:00:00	24:00:00	0.02
322701	Khakhar	AG	Bhimpore	07:00:00	17:00:00	0.02
322705	Kumbhiya	AG	Bhimpore	07:00:00	17:00:00	0.02
322703	Ranveri	JGY	Bhimpore	00:00:00	24:00:00	0.02
322708	Sankalp	HTEX	Bhimpore	00:00:00	24:00:00	0.02
321106	Kamalchhod	AG	Borakhadi	06:00:00	16:00:00	0.02
329801	Dhodhiya	AG	Degama	06:00:00	16:00:00	0.02
329802	Kokanvad	AG	Degama	06:00:00	16:00:00	0.02
329803	Madhuli	JGY	Degama	00:00:00	24:00:00	0.02
532802	Andhatri	JGY	Godadha	00:00:00	24:00:00	0.02
532804	Dharampura	AG	Godadha	06:00:00	16:00:00	0.02
532803	Pahad	AG	Godadha	06:00:00	16:00:00	0.02
532801	Patel	JGY	Godadha	00:00:00	24:00:00	0.02
388705	Dungari	AG	Kelkui	06:00:00	16:00:00	0.02
388703	Godaun	JGY	Kelkui	00:00:00	24:00:00	0.02
388702	Nalotha	AG	Kelkui	06:00:00	16:00:00	0.02
388701	Parshi	AG	Kelkui	06:00:00	16:00:00	0.02
388704	Valmiki	JGY	Kelkui	00:00:00	24:00:00	0.02
322205	Ambach	JGY	Rupvada	00:00:00	24:00:00	0.02
322203	Degama	JGY	Rupvada	00:00:00	24:00:00	0.02
322206	Gandhi	AGSKY	Rupvada	06:00:00	16:00:00	0.02
322202	Khanpur	AGSKY	Rupvada	06:00:00	16:00:00	0.02
322208	Tad	AG	Rupvada	06:00:00	16:00:00	0.02
102503	Bajipura	AG	Valod	06:00:00	16:00:00	0.02
102502	Bavli	AG	Valod	06:00:00	16:00:00	0.02
102512	Butwada	JGY	Valod	00:00:00	24:00:00	0.02
102515	Delwada	JGY	Valod	00:00:00	24:00:00	0.02
102507	Nansad	AG	Valod	06:00:00	16:00:00	0.02
102514	Pavran	AG	Valod	06:00:00	16:00:00	0.02
102511	Rupvada	AG	Valod	06:00:00	16:00:00	0.02
102508	Siker	AG	Valod	06:00:00	16:00:00	0.02
102504	Sumul	JGY	Valod	00:00:00	24:00:00	0.02
102513	Sumul Cattle	HTEX	Valod	00:00:00	24:00:00	0.02
102509	Tokarva	AG	Valod	06:00:00	16:00:00	0.02
102501	Valod (T)	JGY	Valod	00:00:00	24:00:00	0.02
102506	Vedchhi	JGY	Valod	00:00:00	24:00:00	0.02
140202	Buhari	JGY	Virpore	00:00:00	24:00:00	0.02
140206	Dadariya	AG	Virpore	06:00:00	16:00:00	0.02
140204	Virpur	AG	Virpore	06:00:00	16:00:00	0.02`

func init() {
	for _, line := range strings.Split(masterScheduleRaw, "\n") {
		cols := strings.Split(line, "\t")
		if len(cols) >= 6 && strings.TrimSpace(cols[0]) != "" {
			mw := "0.02"
			if len(cols) >= 7 {
				mw = strings.TrimSpace(cols[6])
			}
			masterDB[strings.TrimSpace(cols[0])] = FeederMaster{
				Name:  cols[1],
				Type:  cols[2],
				Start: strings.TrimSpace(cols[4]),
				End:   strings.TrimSpace(cols[5]),
				MW:    mw,
			}
		}
	}
}

// ==========================================
// ROW DATA STRUCTURE
// ==========================================
type Row struct {
	Code      string `json:"Code"`
	TT        string `json:"TT"`
	TTReason  string `json:"TT Reason"`
	SFStart   string `json:"SF Start"`
	SFEnd     string `json:"SF End"`
	SFReason  string `json:"SF Reason"`
	ESDStart  string `json:"ESD Start"`
	ESDEnd    string `json:"ESD End"`
	ESDReason string `json:"ESD Reason"`
	PSDStart  string `json:"PSD Start"`
	PSDEnd    string `json:"PSD End"`
	PSDReason string `json:"PSD Reason"`
}

// ==========================================
// TIME UTILITIES
// ==========================================
func formatTime(t string) string {
	if t == "" {
		return ""
	}
	parts := strings.Split(t, ":")
	if len(parts[0]) == 1 {
		parts[0] = "0" + parts[0]
	}
	if len(parts) > 1 && len(parts[1]) == 1 {
		parts[1] = "0" + parts[1]
	}
	if len(parts) == 2 {
		return parts[0] + ":" + parts[1] + ":00"
	}
	return strings.Join(parts, ":")
}

func toMinutes(t string) int {
	parts := strings.Split(t, ":")
	h, _ := strconv.Atoi(parts[0])
	m := 0
	if len(parts) > 1 {
		m, _ = strconv.Atoi(parts[1])
	}
	return h*60 + m
}

func fromMinutes(m int) string {
	val := ((m % 1440) + 1440) % 1440
	h := int(math.Floor(float64(val) / 60))
	min := val % 60
	return fmt.Sprintf("%02d:%02d:00", h, min)
}

func calculateDuration(start, end string) string {
	if start == "" || end == "" {
		return ""
	}
	d := toMinutes(end) - toMinutes(start)
	if d < 0 {
		d += 1440
	}
	return fromMinutes(d)
}

type CompTime struct {
	Start string
	End   string
}

func calculateCompensation(scheduleEnd, outageStart, outageEnd string) CompTime {
	if scheduleEnd == "" || outageStart == "" || outageEnd == "" {
		return CompTime{}
	}
	duration := toMinutes(outageEnd) - toMinutes(outageStart)
	if duration < 0 {
		duration += 1440
	}
	return CompTime{
		Start: formatTime(scheduleEnd),
		End:   fromMinutes(toMinutes(scheduleEnd) + duration),
	}
}

// feederCategory returns the hidden category field value based on feeder type.
// Based on curl observation: AG feeders → "AGDOM"
// Extend this map if you observe other values for JGY, HTEX, AGSKY, etc.
func feederCategory(feederType string) string {
	switch {
	case strings.HasPrefix(feederType, "AG"):
		return "AGDOM"
	case feederType == "JGY":
		return "JGY"
	case feederType == "HTEX":
		return "HTEX"
	default:
		return feederType
	}
}

// ==========================================
// HTTP HELPERS
// ==========================================
func sha1Hash(s string) string {
	h := sha1.New()
	h.Write([]byte(s))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func newHTTPClient() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 30 * time.Second}
}

func setHeaders(req *http.Request, referer string) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Origin", "http://das.dgvcl.in")
	req.Header.Set("Referer", referer)
}

// fetchPage fetches a page and returns its body HTML.
func fetchPage(client *http.Client, pageURL, referer string) (string, error) {
	req, _ := http.NewRequest("GET", pageURL, nil)
	setHeaders(req, referer)
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return string(body), err
}

func getPage(client *http.Client, pageURL, referer string) error {
	_, err := fetchPage(client, pageURL, referer)
	return err
}

// extractHiddenFields parses HTML and returns all <input type="hidden"> name=value pairs.
var reHidden = regexp.MustCompile(`(?i)<input[^>]+type=["']?hidden["']?[^>]*>`)
var reName = regexp.MustCompile(`(?i)name=["']([^"']*)["']`)
var reValue = regexp.MustCompile(`(?i)value=["']([^"']*)["']`)

func extractHiddenFields(html string) url.Values {
	fields := url.Values{}
	for _, tag := range reHidden.FindAllString(html, -1) {
		nameMatch := reName.FindStringSubmatch(tag)
		valueMatch := reValue.FindStringSubmatch(tag)
		if len(nameMatch) < 2 {
			continue
		}
		name := nameMatch[1]
		value := ""
		if len(valueMatch) >= 2 {
			value = valueMatch[1]
		}
		fields.Set(name, value)
	}
	return fields
}

func login(client *http.Client, username, password string) error {
	if err := getPage(client, baseURL+"/index.php?msg=A", ""); err != nil {
		return fmt.Errorf("session error: %w", err)
	}

	form := url.Values{
		"username": {username},
		"password": {sha1Hash(password)},
		"btnSave":  {""},
	}
	req, _ := http.NewRequest("POST", baseURL+"/loginp.php?opcode=AU", strings.NewReader(form.Encode()))
	setHeaders(req, baseURL+"/index.php?msg=A")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body)

	if strings.Contains(resp.Request.URL.String(), "msg=F") {
		return fmt.Errorf("login failed: invalid credentials")
	}
	log.Printf("Login successful: %s", resp.Request.URL.String())
	return nil
}

// ==========================================
// MAIN SUBMIT
// ==========================================
func submitActivity(client *http.Client, adate string, rows []Row) (string, error) {
	referer := baseURL + "/addactivity.php?adate=" + adate

	// Fetch activity page — extracts hidden fields the server embeds (sdocode, docode, etc.)
	pageHTML, err := fetchPage(client, referer, baseURL+"/home.php")
	if err != nil {
		return "", fmt.Errorf("failed to load activity page: %w", err)
	}
	hiddenFields := extractHiddenFields(pageHTML)
	log.Printf("Extracted %d hidden fields from activity page: %v", len(hiddenFields), hiddenFields)

	sfCount, esdCount, psdCount := 0, 0, 0
	for _, r := range rows {
		if r.SFStart != "" {
			sfCount++
		}
		if r.ESDStart != "" {
			esdCount++
		}
		if r.PSDStart != "" {
			psdCount++
		}
	}

	form := url.Values{}
	// Seed with all hidden fields from the page first
	for k, vs := range hiddenFields {
		form[k] = vs
	}

	// Interruption count fields
	form.Set("permanantfault", strconv.Itoa(sfCount))
	form.Set("noofesdonss", "0")
	form.Set("noofesdonfeeder", strconv.Itoa(esdCount))
	form.Set("noofpsdonss", "0")
	form.Set("noofpsdonfeeder", strconv.Itoa(psdCount))

	// FIX: Use "Y" (not "on") to match what the browser sends
	if esdCount > 0 {
		form.Set("IsFeederDown", "Y")
	}
	if psdCount > 0 {
		form.Set("IsFeederDownPSD", "Y")
	}

	for _, row := range rows {
		master, hasMaster := masterDB[row.Code]

		// --- TT ---
		if row.TT != "" && row.TT != "0" {
			form.Add("ttfeedername[]", row.Code)
			form.Add("ttnumber[]", row.TT)
			form.Add("ttreason[]", row.TTReason)
		}

		// --- SF (Permanent Fault) ---
		if row.SFStart != "" {
			form.Add("pffeedername[]", row.Code)
			form.Add("pffromtime[]", formatTime(row.SFStart))
			form.Add("pftotime[]", formatTime(row.SFEnd))
			form.Add("pftotalhr[]", calculateDuration(row.SFStart, row.SFEnd))
			form.Add("pfreason[]", row.SFReason)
			if hasMaster {
				form.Add("pfMW[]", master.MW)
			}
			if hasMaster && strings.Contains(master.Type, "AG") {
				// FIX: Add hdnsffeedercategory[] — required by PHP, observed in curl
				form.Add("hdnsffeedercategory[]", feederCategory(master.Type))

				comp := calculateCompensation(master.End, row.SFStart, row.SFEnd)
				form.Add("SFthreephasefromtime[]", formatTime(master.Start))
				form.Add("SFthreephasetotime[]", formatTime(master.End))
				form.Add("SFthreephasetotalhr[]", calculateDuration(master.Start, master.End))
				form.Add("SFcompesationfromtime[]", comp.Start)
				form.Add("SFcompesationtotime[]", comp.End)
				form.Add("SFcompesationtotalhr[]", calculateDuration(comp.Start, comp.End))
				form.Add("SFcompesationpowersuppy[]", calculateDuration(master.Start, master.End))
			}
		}

		// --- ESD ---
		if row.ESDStart != "" {
			form.Add("esdfeedername[]", row.Code)
			form.Add("esdfeederfromtime[]", formatTime(row.ESDStart))
			form.Add("esdfeedertotime[]", formatTime(row.ESDEnd))
			form.Add("esdfeedertotalhr[]", calculateDuration(row.ESDStart, row.ESDEnd))
			form.Add("esdfeederreason[]", row.ESDReason)
			if hasMaster {
				form.Add("esdfeederMW[]", master.MW)
			}
			if hasMaster && strings.Contains(master.Type, "AG") {
				// FIX: Add hdnesdfeedercategory[] — mirror of SF pattern for ESD
				form.Add("hdnesdfeedercategory[]", feederCategory(master.Type))

				comp := calculateCompensation(master.End, row.ESDStart, row.ESDEnd)
				form.Add("ESDthreephasefromtime[]", formatTime(master.Start))
				form.Add("ESDthreephasetotime[]", formatTime(master.End))
				form.Add("ESDthreephasetotalhr[]", calculateDuration(master.Start, master.End))
				form.Add("ESDcompesationfromtime[]", comp.Start)
				form.Add("ESDcompesationtotime[]", comp.End)
				form.Add("ESDcompesationtotalhr[]", calculateDuration(comp.Start, comp.End))
				form.Add("ESDcompesationpowersuppy[]", calculateDuration(master.Start, master.End))
			}
		}

		// --- PSD ---
		if row.PSDStart != "" {
			form.Add("psdfeedername[]", row.Code)
			form.Add("psdfeederfromtime[]", formatTime(row.PSDStart))
			form.Add("psdfeedertotime[]", formatTime(row.PSDEnd))
			form.Add("psdfeedertotalhr[]", calculateDuration(row.PSDStart, row.PSDEnd))
			form.Add("psdfeederreason[]", row.PSDReason)
			if hasMaster {
				form.Add("psdfeederMW[]", master.MW)
			}
			if hasMaster && strings.Contains(master.Type, "AG") {
				// FIX: Add hdnpsdfeedercategory[] — required by PHP, observed in curl
				form.Add("hdnpsdfeedercategory[]", feederCategory(master.Type))

				comp := calculateCompensation(master.End, row.PSDStart, row.PSDEnd)
				form.Add("PSDthreephasefromtime[]", formatTime(master.Start))
				form.Add("PSDthreephasetotime[]", formatTime(master.End))
				form.Add("PSDthreephasetotalhr[]", calculateDuration(master.Start, master.End))
				form.Add("PSDcompesationfromtime[]", comp.Start)
				form.Add("PSDcompesationtotime[]", comp.End)
				form.Add("PSDcompesationtotalhr[]", calculateDuration(comp.Start, comp.End))
				form.Add("PSDcompesationpowersuppy[]", calculateDuration(master.Start, master.End))
			}
		}
	}

	form.Set("submitinterruption", "")

	log.Printf("Form POST body: %s", form.Encode())
	req, _ := http.NewRequest("POST", baseURL+"/createtextfiles.php?type=INTD", strings.NewReader(form.Encode()))
	setHeaders(req, referer)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	snippet := string(respBody)
	if len(snippet) > 2000 {
		snippet = snippet[:2000]
	}
	log.Printf("Server response (final URL=%s):\n%s", resp.Request.URL.String(), snippet)

	return resp.Request.URL.String(), nil
}

// ==========================================
// API REQUEST / RESPONSE
// ==========================================
type RunScriptRequest struct {
	Rows         []Row  `json:"rows"`
	ActivityDate string `json:"activityDate"`
}

type RunScriptResponse struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	FinalURL string `json:"finalUrl,omitempty"`
}

// ==========================================
// HANDLERS
// ==========================================
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func runScriptHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, RunScriptResponse{Success: false, Message: "method not allowed"})
		return
	}

	var req RunScriptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, RunScriptResponse{Success: false, Message: "invalid JSON: " + err.Error()})
		return
	}

	if len(req.Rows) == 0 {
		writeJSON(w, http.StatusBadRequest, RunScriptResponse{Success: false, Message: "no rows provided"})
		return
	}
	if req.ActivityDate == "" {
		writeJSON(w, http.StatusBadRequest, RunScriptResponse{Success: false, Message: "activityDate is required (DD-MM-YYYY)"})
		return
	}

	username := "2124087"
	password := "Valod@123"
	if username == "" || password == "" {
		writeJSON(w, http.StatusInternalServerError, RunScriptResponse{Success: false, Message: "server credentials not configured"})
		return
	}

	// Each request gets its own HTTP client with its own cookie jar (session isolation)
	httpClient := newHTTPClient()

	log.Printf("Starting automation for date=%s rows=%d", req.ActivityDate, len(req.Rows))
	for i, r := range req.Rows {
		log.Printf("  row[%d]: Code=%q TT=%q SF=%q-%q ESD=%q-%q PSD=%q-%q",
			i, r.Code, r.TT, r.SFStart, r.SFEnd, r.ESDStart, r.ESDEnd, r.PSDStart, r.PSDEnd)
	}

	if err := login(httpClient, username, password); err != nil {
		writeJSON(w, http.StatusUnauthorized, RunScriptResponse{Success: false, Message: "login failed: " + err.Error()})
		return
	}

	finalURL, err := submitActivity(httpClient, req.ActivityDate, req.Rows)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, RunScriptResponse{Success: false, Message: "submit failed: " + err.Error()})
		return
	}

	log.Printf("Automation complete. Final URL: %s", finalURL)
	writeJSON(w, http.StatusOK, RunScriptResponse{
		Success:  true,
		Message:  "Interruption details submitted successfully.",
		FinalURL: finalURL,
	})
}

func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	default:
		cmd = "xdg-open"
		args = []string{url}
	}
	if err := exec.Command(cmd, args...).Start(); err != nil {
		log.Printf("could not open browser: %v (open %s manually)", err, url)
	}
}

// ==========================================
// MAIN — HTTP Server
// ==========================================
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", corsMiddleware(healthHandler))
	mux.HandleFunc("/api/run-script", corsMiddleware(
		http.TimeoutHandler(http.HandlerFunc(runScriptHandler), 60*time.Second,
			`{"success":false,"message":"request timeout"}`).ServeHTTP))

	staticFS, _ := fs.Sub(staticFiles, ".")
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		log.Printf("Server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	if os.Getenv("HEADLESS") == "" {
		openBrowser("http://localhost:" + port)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown: ", err)
	}
	log.Println("Server exited")
}