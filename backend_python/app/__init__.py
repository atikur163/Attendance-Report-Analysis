"""
University Student Attendance Management & Analytics System
Application Factory & Blueprint Registration
"""
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

db = SQLAlchemy()

def create_app(config_name=None):
    app = Flask(__name__)
    
    # Load configuration
    from app.config import config_by_name
    cfg_name = config_name or os.getenv('FLASK_ENV', 'development')
    app.config.from_object(config_by_name.get(cfg_name, config_by_name['development']))
    
    # Initialize extensions
    db.init_app(app)
    CORS(app)
    
    # Register blueprints
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'system': 'UniAttend University Attendance Platform',
            'version': '1.0.0',
            'environment': cfg_name
        })
        
    return app
