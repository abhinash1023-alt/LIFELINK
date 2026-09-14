# LifeLink

LifeLink is a smart emergency blood coordination platform created to help
patients, families, donors, hospitals, and blood banks coordinate during
urgent blood requirements.

## Project Vision

The main purpose of LifeLink is simple:

> One request. Many helping hands.

During emergencies, families often waste valuable time searching for blood
donors through different groups, phone calls, and social media platforms.

LifeLink brings the most important actions into one platform:

- Create an emergency blood request
- Select the required blood group
- Enter hospital and contact details
- Register as a blood donor
- Match donors according to blood group
- Display emergency request IDs
- Track demo activity
- Demonstrate Smart Donor Relay
- Present a future hospital command dashboard

## Main Features

### 1. Emergency Blood Request

Users can create a blood request by entering:

- Patient name
- Blood group
- Number of units
- Urgency level
- Hospital name
- City
- Emergency contact
- Additional information

Each request receives a unique request ID.

### 2. Donor Registration

People can register as donors by entering:

- Full name
- Blood group
- City
- Phone number
- Availability

### 3. Smart Donor Matching

The demo checks whether registered donors have the same blood group and
are currently available.

In a future production version, matching can also consider:

- Distance
- Donor eligibility
- Last donation date
- Hospital requirements
- Emergency priority
- Donor response history

### 4. Smart Donor Relay

The Smart Donor Relay is a future feature that expands the search radius
step by step.

Example:

1. Notify donors within 5 km
2. If there is no response, expand to 10 km
3. If required, expand to 25 km
4. Notify partner blood banks and hospitals

This prevents every donor from receiving unnecessary notifications at once.

### 5. Emergency QR Profile

A future emergency QR profile can contain limited essential information
such as:

- Emergency contact
- Blood group
- Allergies
- Important medical notes

Access to real medical information must require consent, authentication,
and proper security.

## Technologies Used

- HTML5
- CSS3
- JavaScript
- LocalStorage
- Responsive design
- Google Fonts

## How to Run

1. Download or clone this repository.
2. Open `index.html` in a browser.
3. Create a blood request.
4. Register a donor.
5. Open the dashboard section to see demo activity.

For the best development experience, use Visual Studio Code with the
Live Server extension.

## Important Note

This project is currently a demonstration prototype.

It does not connect to real hospitals, blood banks, or real donor databases.
It does not guarantee blood availability.

A production version would require:

- Secure backend APIs
- User authentication
- Hospital and blood-bank verification
- Consent management
- Encrypted medical data
- Real-time notifications
- Database integration
- Medical and legal review
- Proper donor eligibility checks

## Founder

M. Abinash

## Project Motto

Find blood. Save a life.
