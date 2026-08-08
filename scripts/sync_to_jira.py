import base64
import json
import os
import sys

import requests


def create_issue():
    event_path = os.environ["GITHUB_EVENT_PATH"]

    with open(event_path, "r", encoding="utf-8") as f:
        event = json.load(f)

    issue = event["issue"]

    title = issue["title"]
    body = issue.get("body") or ""

    email = os.environ["JIRA_EMAIL"]
    token = os.environ["JIRA_API_TOKEN"]
    base = os.environ["JIRA_BASE_URL"]
    project = os.environ["JIRA_PROJECT_KEY"]

    auth = base64.b64encode(f"{email}:{token}".encode()).decode()

    headers = {
        "Authorization": f"Basic {auth}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    payload = {
        "fields": {
            "project": {
                "key": project
            },
            "summary": title,
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "text": body,
                                "type": "text"
                            }
                        ]
                    }
                ]
            },
            "issuetype": {
                "name": "Story"
            }
        }
    }

    response = requests.post(
        f"{base}/rest/api/3/issue",
        headers=headers,
        json=payload,
    )

    print(response.status_code)
    print(response.text)

    response.raise_for_status()


if __name__ == "__main__":
    create_issue()