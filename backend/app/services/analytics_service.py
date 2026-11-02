"""High-Performance Attendance Analytics Service using Pandas & NumPy."""
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from app.core.firebase import get_firestore_db
from app.core.logging import logger
from app.utils.calculations import compute_student_course_analytics


class AnalyticsService:
    def __init__(self):
        self.db = get_firestore_db()

    def get_course_analytics(self, course_offering_id: str) -> Dict[str, Any]:
        """Calculates course-wide attendance distribution, eligibility, and risk tiers using Pandas."""
        if not self.db:
            return {"error": "Database unavailable."}

        # Fetch Course Offering
        offering_doc = self.db.collection("course_offerings").document(course_offering_id).get()
        if not offering_doc.exists:
            return {"error": "Course offering not found."}
        offering = offering_doc.to_dict()

        # Fetch Course Syllabus
        course_id = offering.get("courseId")
        course_doc = self.db.collection("courses").document(course_id).get()
        course = course_doc.to_dict() if course_doc.exists else {}

        # Fetch Enrolled Students
        enrollments = [
            d.to_dict() for d in self.db.collection("student_enrollments")
            .where("courseOfferingId", "==", course_offering_id)
            .where("status", "==", "ENROLLED").stream()
        ]
        student_ids = [e["studentId"] for e in enrollments]

        if not student_ids:
            return {
                "course_offering_id": course_offering_id,
                "course_code": course.get("code", "N/A"),
                "course_name": course.get("name", "N/A"),
                "total_enrolled": 0,
                "conducted_classes": offering.get("conductedClasses", 0),
                "planned_classes": offering.get("plannedClasses", 35),
                "average_attendance_percentage": 0.0,
                "eligible_count": 0,
                "at_risk_count": 0,
                "critical_debarred_count": 0,
                "students": []
            }

        # Fetch Students Data
        student_map = {}
        for s_doc in self.db.collection("students").stream():
            s_dict = s_doc.to_dict()
            if s_dict.get("id") in student_ids or s_doc.id in student_ids:
                student_map[s_dict.get("id", s_doc.id)] = s_dict

        # Fetch Attendance Records
        records = [
            d.to_dict() for d in self.db.collection("attendance_records")
            .where("courseOfferingId", "==", course_offering_id).stream()
        ]

        # Analyze using calculation engine for each student
        student_results = []
        for s_id in student_ids:
            s_data = student_map.get(s_id, {"id": s_id, "name": "Unknown", "studentId": "N/A"})
            s_records = [r for r in records if r.get("studentId") == s_id]

            analytics = compute_student_course_analytics(
                planned_classes=offering.get("plannedClasses", 35),
                conducted_classes=offering.get("conductedClasses", 0),
                records=s_records
            )

            student_results.append({
                "student_id": s_id,
                "student_name": s_data.get("name", "Unknown"),
                "student_roll": s_data.get("studentId", "N/A"),
                "course_offering_id": course_offering_id,
                "course_code": course.get("code", "N/A"),
                "course_name": course.get("name", "N/A"),
                **analytics
            })

        # Process overall aggregates with Pandas DataFrame
        df = pd.DataFrame(student_results)
        avg_pct = round(float(df["current_percentage"].mean()), 2) if not df.empty else 0.0
        eligible_count = int((df["is_eligible"] == True).sum()) if not df.empty else 0
        at_risk_count = int(df["risk_level"].isin(["WARNING", "HIGH_RISK"]).sum()) if not df.empty else 0
        critical_count = int((df["risk_level"] == "CRITICAL").sum()) if not df.empty else 0

        return {
            "course_offering_id": course_offering_id,
            "course_code": course.get("code", "N/A"),
            "course_name": course.get("name", "N/A"),
            "total_enrolled": len(student_ids),
            "conducted_classes": offering.get("conductedClasses", 0),
            "planned_classes": offering.get("plannedClasses", 35),
            "average_attendance_percentage": avg_pct,
            "eligible_count": eligible_count,
            "at_risk_count": at_risk_count,
            "critical_debarred_count": critical_count,
            "students": student_results
        }

    def get_student_overall_analytics(self, student_id: str) -> Dict[str, Any]:
        """Aggregates all enrolled courses for a given student."""
        if not self.db:
            return {"error": "Database unavailable."}

        enrollments = [
            d.to_dict() for d in self.db.collection("student_enrollments")
            .where("studentId", "==", student_id)
            .where("status", "==", "ENROLLED").stream()
        ]

        course_results = []
        for en in enrollments:
            co_id = en.get("courseOfferingId")
            offering_doc = self.db.collection("course_offerings").document(co_id).get()
            if not offering_doc.exists:
                continue
            offering = offering_doc.to_dict()

            course_doc = self.db.collection("courses").document(offering.get("courseId")).get()
            course = course_doc.to_dict() if course_doc.exists else {}

            records = [
                d.to_dict() for d in self.db.collection("attendance_records")
                .where("courseOfferingId", "==", co_id)
                .where("studentId", "==", student_id).stream()
            ]

            stats = compute_student_course_analytics(
                planned_classes=offering.get("plannedClasses", 35),
                conducted_classes=offering.get("conductedClasses", 0),
                records=records
            )

            course_results.append({
                "course_offering_id": co_id,
                "course_code": course.get("code", "N/A"),
                "course_name": course.get("name", "N/A"),
                "credit": course.get("credit", 3.0),
                **stats
            })

        df = pd.DataFrame(course_results) if course_results else pd.DataFrame()
        overall_avg = round(float(df["current_percentage"].mean()), 2) if not df.empty else 0.0
        all_eligible = bool((df["is_eligible"] == True).all()) if not df.empty else True

        return {
            "student_id": student_id,
            "total_courses": len(course_results),
            "overall_average_percentage": overall_avg,
            "all_courses_eligible": all_eligible,
            "courses": course_results
        }

    def get_department_risk_distribution(self, department_id: str) -> Dict[str, Any]:
        """Calculates department-level risk breakdown using NumPy and Pandas."""
        if not self.db:
            return {"error": "Database unavailable."}

        dept_doc = self.db.collection("departments").document(department_id).get()
        dept = dept_doc.to_dict() if dept_doc.exists else {"code": department_id}

        students = [
            d.to_dict() for d in self.db.collection("students")
            .where("departmentId", "==", department_id).stream()
        ]

        if not students:
            return {
                "department_id": department_id,
                "department_code": dept.get("code", department_id),
                "total_students": 0,
                "safe_count": 0,
                "warning_count": 0,
                "high_risk_count": 0,
                "critical_count": 0,
                "overall_average_percentage": 0.0
            }

        student_percentages = []
        risk_counts = {"SAFE": 0, "WARNING": 0, "HIGH_RISK": 0, "CRITICAL": 0}

        for s in students:
            summary = self.get_student_overall_analytics(s["id"])
            pct = summary.get("overall_average_percentage", 0.0)
            student_percentages.append(pct)

            if pct >= 75.0:
                risk_counts["SAFE"] += 1
            elif pct >= 60.0:
                risk_counts["WARNING"] += 1
            elif pct >= 45.0:
                risk_counts["HIGH_RISK"] += 1
            else:
                risk_counts["CRITICAL"] += 1

        overall_mean = round(float(np.mean(student_percentages)), 2) if student_percentages else 0.0

        return {
            "department_id": department_id,
            "department_code": dept.get("code", department_id),
            "total_students": len(students),
            "safe_count": risk_counts["SAFE"],
            "warning_count": risk_counts["WARNING"],
            "high_risk_count": risk_counts["HIGH_RISK"],
            "critical_count": risk_counts["CRITICAL"],
            "overall_average_percentage": overall_mean
        }


analytics_service = AnalyticsService()
