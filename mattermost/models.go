package mattermost

type DialogElement struct {
	DisplayName string `json:"display_name"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	SubType     string `json:"subtype,omitempty"`
	Placeholder string `json:"placeholder,omitempty"`
	Default     string `json:"default,omitempty"`
	HelpText    string `json:"help_text,omitempty"`
	DataSource  string `json:"data_source,omitempty"`
	Optional    bool   `json:"optional,omitempty"`
}

type Dialog struct {
	CallbackID       string          `json:"callback_id"`
	Title            string          `json:"title"`
	IntroductionText string          `json:"introduction_text,omitempty"`
	Elements         []DialogElement `json:"elements"`
	SubmitLabel      string          `json:"submit_label,omitempty"`
	NotifyOnCancel   bool            `json:"notify_on_cancel,omitempty"`
	State            string          `json:"state,omitempty"`
}

type OpenDialogRequest struct {
	TriggerID string `json:"trigger_id"`
	URL       string `json:"url"`
	Dialog    Dialog `json:"dialog"`
}

type DialogSubmissionRequest struct {
	Type       string                 `json:"type"`
	CallbackID string                 `json:"callback_id"`
	State      string                 `json:"state"`
	UserID     string                 `json:"user_id"`
	ChannelID  string                 `json:"channel_id"`
	TeamID     string                 `json:"team_id"`
	Submission map[string]interface{} `json:"submission"`
}

type DialogState struct {
	SourceChannelID  string `json:"source_channel_id"`
	TriggeringUserID string `json:"triggering_user_id"`
}

type Channel struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"`
}

type ChannelMember struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
}

type Post struct {
	ID        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UserID    string `json:"user_id"`
	ChannelID string `json:"channel_id"`
	Message   string `json:"message"`
	Type      string `json:"type"`
}

type PostList struct {
	Order []string        `json:"order"`
	Posts map[string]Post `json:"posts"`
}

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}
