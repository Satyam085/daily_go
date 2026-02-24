package main

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

var baseURL = "https://das.dgvcl.in/DailyActivity"

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

var masterScheduleRaw = `322707	Bahej	AG	Bhimpore	08:00:00	16:00:00	0.02
322704	Bhimpore	JGY	Bhimpore	00:00:00	24:00:00	0.02
322706	Hathuka	AG	Bhimpore	08:00:00	16:00:00	0.02
322702	Hill	HTEX	Bhimpore	00:00:00	24:00:00	0.02
322701	Khakhar	AG	Bhimpore	08:00:00	16:00:00	0.02
322705	Kumbhiya	AG	Bhimpore	08:00:00	16:00:00	0.02
322703	Ranveri	JGY	Bhimpore	00:00:00	24:00:00	0.02
322708	Sankalp	HTEX	Bhimpore	00:00:00	24:00:00	0.02
321106	Kamalchhod	AG	Borakhadi	07:00:00	15:00:00	0.02
329801	Dhodhiya	AG	Degama	07:00:00	15:00:00	0.02
329802	Kokanvad	AG	Degama	07:00:00	15:00:00	0.02
329803	Madhuli	JGY	Degama	00:00:00	24:00:00	0.02
532802	Andhatri	JGY	Godadha	00:00:00	24:00:00	0.02
532804	Dharampura	AG	Godadha	07:00:00	15:00:00	0.02
532803	Pahad	AG	Godadha	07:00:00	15:00:00	0.02
532801	Patel	JGY	Godadha	00:00:00	24:00:00	0.02
388705	Dungari	AG	Kelkui	07:00:00	15:00:00	0.02
388703	Godaun	JGY	Kelkui	00:00:00	24:00:00	0.02
388702	Nalotha	AG	Kelkui	07:00:00	15:00:00	0.02
388701	Parshi	AG	Kelkui	07:00:00	15:00:00	0.02
388704	Valmiki	JGY	Kelkui	00:00:00	24:00:00	0.02
322205	Ambach	JGY	Rupvada	00:00:00	24:00:00	0.02
322203	Degama	JGY	Rupvada	00:00:00	24:00:00	0.02
322206	Gandhi	AGSKY	Rupvada	07:00:00	15:00:00	0.02
322202	Khanpur	AGSKY	Rupvada	07:00:00	15:00:00	0.02
322208	Tad	AG	Rupvada	07:00:00	15:00:00	0.02
102503	Bajipura	AG	Valod	07:00:00	15:00:00	0.02
102502	Bavli	AG	Valod	07:00:00	15:00:00	0.02
102512	Butwada	JGY	Valod	00:00:00	24:00:00	0.02
102507	Nansad	AG	Valod	07:00:00	15:00:00	0.02
102514	Pavran	AG	Valod	07:00:00	15:00:00	0.02
102511	Rupvada	AG	Valod	07:00:00	15:00:00	0.02
102508	Siker	AG	Valod	07:00:00	15:00:00	0.02
102504	Sumul	JGY	Valod	00:00:00	24:00:00	0.02
102513	Sumul Cattle	HTEX	Valod	00:00:00	24:00:00	0.02
102509	Tokarva	AG	Valod	07:00:00	15:00:00	0.02
102501	Valod (T)	JGY	Valod	00:00:00	24:00:00	0.02
102506	Vedchhi	JGY	Valod	00:00:00	24:00:00	0.02
140202	Buhari	JGY	Virpore	00:00:00	24:00:00	0.02
140206	Dadariya	AG	Virpore	07:00:00	15:00:00	0.02
140204	Virpur	AG	Virpore	07:00:00	15:00:00	0.02`

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
// Frontend sends JSON with these exact field names
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
	req.Header.Set("Origin", "https://das.dgvcl.in")
	req.Header.Set("Referer", referer)
}

func getPage(client *http.Client, pageURL, referer string) error {
	req, _ := http.NewRequest("GET", pageURL, nil)
	setHeaders(req, referer)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body)
	return nil
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

	if err := getPage(client, referer, baseURL+"/home.php"); err != nil {
		return "", fmt.Errorf("failed to load activity page: %w", err)
	}

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
	form.Set("permanantfault", strconv.Itoa(sfCount))
	form.Set("noofesdonss", "0")
	form.Set("noofesdonfeeder", strconv.Itoa(esdCount))
	form.Set("noofpsdonss", "0")
	form.Set("noofpsdonfeeder", strconv.Itoa(psdCount))

	sfIdx, esdIdx, psdIdx := 1, 1, 1

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
			form.Add("pfreason[]", row.SFReason)
			if hasMaster {
				form.Add("pfMW[]", master.MW)
			}
			if hasMaster && strings.Contains(master.Type, "AG") {
				key := strconv.Itoa(sfIdx)
				form.Set("SFthreephasefromtime"+key, formatTime(master.Start))
				form.Set("SFthreephasetotime"+key, formatTime(master.End))
				comp := calculateCompensation(master.End, row.SFStart, row.SFEnd)
				form.Set("SFcompesationfromtime"+key, comp.Start)
				form.Set("SFcompesationtotime"+key, comp.End)
				form.Set("SFcompesationpowersuppy"+key, calculateDuration(master.Start, master.End))
			}
			sfIdx++
		}

		// --- ESD ---
		if row.ESDStart != "" {
			form.Add("esdfeedername[]", row.Code)
			form.Add("esdfeederfromtime[]", formatTime(row.ESDStart))
			form.Add("esdfeedertotime[]", formatTime(row.ESDEnd))
			form.Add("esdfeederreason[]", row.ESDReason)
			if hasMaster {
				form.Add("esdfeederMW[]", master.MW)
			}
			if hasMaster && strings.Contains(master.Type, "AG") {
				key := strconv.Itoa(esdIdx)
				form.Set("ESDthreephasefromtime"+key, formatTime(master.Start))
				form.Set("ESDthreephasetotime"+key, formatTime(master.End))
				comp := calculateCompensation(master.End, row.ESDStart, row.ESDEnd)
				form.Set("ESDcompesationfromtime"+key, comp.Start)
				form.Set("ESDcompesationtotime"+key, comp.End)
				form.Set("ESDcompesationpowersuppy"+key, calculateDuration(master.Start, master.End))
			}
			esdIdx++
		}

		// --- PSD ---
		if row.PSDStart != "" {
			form.Add("psdfeedername[]", row.Code)
			form.Add("psdfeederfromtime[]", formatTime(row.PSDStart))
			form.Add("psdfeedertotime[]", formatTime(row.PSDEnd))
			form.Add("psdfeederreason[]", row.PSDReason)
			if hasMaster {
				form.Add("psdfeederMW[]", master.MW)
			}
			if hasMaster && strings.Contains(master.Type, "AG") {
				key := strconv.Itoa(psdIdx)
				form.Set("PSDthreephasefromtime"+key, formatTime(master.Start))
				form.Set("PSDthreephasetotime"+key, formatTime(master.End))
				comp := calculateCompensation(master.End, row.PSDStart, row.PSDEnd)
				form.Set("PSDcompesationfromtime"+key, comp.Start)
				form.Set("PSDcompesationtotime"+key, comp.End)
				form.Set("PSDcompesationpowersuppy"+key, calculateDuration(master.Start, master.End))
			}
			psdIdx++
		}
	}

	form.Set("submitinterruption", "")

	req, _ := http.NewRequest("POST", baseURL+"/createtextfiles.php?type=INTD", strings.NewReader(form.Encode()))
	setHeaders(req, referer)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body)

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

	username := os.Getenv("DAS_USERNAME")
	password := os.Getenv("DAS_PASSWORD")
	if username == "" || password == "" {
		writeJSON(w, http.StatusInternalServerError, RunScriptResponse{Success: false, Message: "server credentials not configured"})
		return
	}

	// Each request gets its own HTTP client with its own cookie jar (session isolation)
	httpClient := newHTTPClient()

	log.Printf("Starting automation for date=%s rows=%d", req.ActivityDate, len(req.Rows))

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
	mux.HandleFunc("/api/run-script", corsMiddleware(runScriptHandler))

	log.Printf("Server listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}