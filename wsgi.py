from app import create_app

app = create_app()

if __name__ == '__main__':
        app.run(host='0.0.0.0', port=5000, debug=True)


# $env:DATABASE_URL = "sqlite:///C:/Users/Med Achref Bousnina/dental_app/app/instance/patients.db"
